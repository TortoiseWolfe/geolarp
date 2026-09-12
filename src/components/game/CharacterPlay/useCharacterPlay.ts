import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Character,
  SkillName,
  generateCharacter,
  loadCharacter,
  markExported,
  ratingFor,
  saveCharacter,
  spendCharacterPoints,
  toExportJSON,
  earnCharacterPoints,
} from '@/lib/geolarp/character';
import {
  Cell,
  CellOffset,
  cellOf,
  neighbour,
  offsetMetres,
  seedOf,
  utcDay,
  type HexDirection,
} from '@/lib/geolarp/cell';
import { Encounter, encounterFor } from '@/lib/geolarp/encounter';
import { rewardFor } from '@/lib/geolarp/reward';
import { RollResult } from '@/lib/geolarp/dice';

/**
 * How the player's cell is decided.
 *
 * BOTH NON-GPS MODES ARE PUBLISHED COMMITMENTS: "Deny the permission entirely and
 * it still plays: pick a zone by hand, or use grid movement and play the whole
 * game with no GPS at all" (`the-world-is-the-board.md:93-94`).
 *
 * The post used to promise a THIRD fallback — "a coarse network location" — and
 * this comment paraphrased all three while the code shipped two. It was not a
 * missing feature: the sentence is conditioned on the permission being DENIED, and
 * after denial no location is obtainable at any accuracy without an IP lookup,
 * which would send the visitor's address to a third party on the page whose whole
 * claim is that nothing about their location is collected. Unimplementable as
 * written rather than unimplemented. The post was amended to describe the two that
 * exist and work (#112).
 */
export type LocationMode = 'gps' | 'zone' | 'grid';

/** Hand-pickable zones, for a player who will not or cannot share a fix. */
export const ZONES: ReadonlyArray<{
  id: string;
  name: string;
  lat: number;
  lon: number;
}> = [
  {
    id: 'chattanooga',
    name: 'Chattanooga riverfront',
    lat: 35.0556,
    lon: -85.3097,
  },
  { id: 'downtown', name: 'Downtown Chattanooga', lat: 35.0456, lon: -85.3097 },
  { id: 'ridge', name: 'Missionary Ridge', lat: 35.0289, lon: -85.2688 },
  { id: 'lookout', name: 'Lookout Mountain', lat: 35.0087, lon: -85.3395 },
];

export interface UseCharacterPlayReturn {
  character: Character | null;
  /** False until localStorage has been read; nothing renders before that. */
  ready: boolean;
  cell: Cell | null;
  /**
   * Where the player's cell was last ANCHORED — by a fix or by a zone, never
   * by walking the grid. It is what "back to where I started" means, and what
   * `offset` is measured from.
   */
  origin: Cell | null;
  /** How far the current cell is from `origin`, or null when they match. */
  offset: CellOffset | null;
  encounter: Encounter | null;
  selectedSkill: SkillName | null;
  result: RollResult | null;
  /** Points paid by the most recent resolution, or null. */
  earned: number | null;
  mode: LocationMode;
  zoneId: string;
  begin: (name: string) => void;
  regenerate: () => void;
  exportCharacter: () => void;
  setMode: (mode: LocationMode) => void;
  setZone: (id: string) => void;
  setCellFromFix: (lat: number, lon: number) => void;
  step: (direction: HexDirection) => void;
  /** Return to the last anchored cell. A no-op when already there. */
  resetToOrigin: () => void;
  selectSkill: (skill: SkillName) => void;
  resolve: (result: RollResult, pointsSpent: number) => void;
}

/**
 * Everything the play surface needs, and nothing it does not.
 *
 * The RAW FIX NEVER ENTERS STATE. `setCellFromFix` quantises on the way in and
 * stores only the cell, so no later render, log or export can leak a precise
 * position — the promise at `:87-90` is structural rather than a habit.
 */
export function useCharacterPlay(
  today: Date = new Date()
): UseCharacterPlayReturn {
  const [character, setCharacter] = useState<Character | null>(null);
  const [ready, setReady] = useState(false);
  const [cell, setCell] = useState<Cell | null>(null);
  const [mode, setModeState] = useState<LocationMode>('zone');
  const [zoneId, setZoneId] = useState<string>(ZONES[1].id);
  const [origin, setOrigin] = useState<Cell | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillName | null>(null);
  const [result, setResult] = useState<RollResult | null>(null);

  useEffect(() => {
    setCharacter(loadCharacter());
    setReady(true);
  }, []);

  // A zone selection is just a fix the player chose; quantise it the same way.
  useEffect(() => {
    if (mode !== 'zone') return;
    const zone = ZONES.find((z) => z.id === zoneId) ?? ZONES[1];
    const c = cellOf(zone.lat, zone.lon);
    setCell(c);
    setOrigin(c);
  }, [mode, zoneId]);

  useEffect(() => {
    if (mode !== 'grid' || cell) return;
    // Grid play needs somewhere to start; the first zone will do.
    const c = cellOf(ZONES[1].lat, ZONES[1].lon);
    setCell(c);
    setOrigin(c);
  }, [mode, cell]);

  // The one clock. Shared with `seedOf` so the world and the ledger cannot
  // disagree about when the day turned.
  const dayKey = utcDay(today);
  const encounter = useMemo(
    () =>
      cell ? encounterFor(seedOf(cell, new Date(`${dayKey}T12:00:00Z`))) : null,
    [cell, dayKey]
  );

  /**
   * Outcomes resolved since this page loaded, keyed by encounter seed.
   *
   * A REF, NOT STORAGE, and that is the privacy design rather than laziness. A
   * durable map of resolved seeds is a map of cells and dates — a location
   * history, which `the-world-is-the-board.md:92-93` says is not collected.
   * The daily earn cap is what makes forgetting this on reload safe: a reload
   * can re-collect on a cell, bounded to points the player would have earned
   * by walking anyway.
   */
  const resolved = useRef(new Map<string, RollResult>());
  /** `${seed}|${skill}` — an outcome belongs to the skill that produced it. */
  const keyFor = (seed: string, skill: SkillName | null) =>
    `${seed}|${skill ?? ''}`;
  /** `${seed}|${skill}|${stake}` already charged. Identical dice, one bill. */
  const charged = useRef(new Set<string>());
  /** Set when the player enters GPS mode; the next fix anchors and clears it (#140). */
  const anchorNextFix = useRef(false);

  // A new cell is a new encounter — but an outcome already earned on this cell
  // comes BACK rather than being wiped. Stepping away and returning used to
  // blank the result, which is what made the loop feel like it had no memory.
  //
  // THE SELECTION RESETS TO NULL, NOT TO THE ENCOUNTER'S SUGGESTION (#63).
  //
  // It used to open the suggested skill, on the reasoning that the common path
  // should cost no taps. That reasoning was sound and the consequence was not: a
  // cell pays ONCE (`firstResolution` below, keyed on the cell), so whichever
  // skill is open when the player arrives collects the only reward the cell will
  // ever give. Pre-opening one therefore handed it the payout by default.
  //
  // That mattered more than it looks. Measured over 200,000 encounters, NINE of
  // the twenty skills carry every suggestion `PROFILES` makes and the other eleven
  // are suggested 0.00% of the time — `Navigate`, `Sprint` and `Stamina` among
  // them, in a game about walking to places. So the pre-selection was quietly
  // making eleven skills non-economic: fully rollable, never the default claim.
  //
  // The owner's ruling is that the suggestion is ADVICE. The shipped copy already
  // said so — "A cell suggests a skill, but anything you can argue for is fair"
  // — and the code disagreed with it. Now the player picks, every skill starts
  // equal, and the suggestion persuades rather than pre-empts. The `Go to {skill}`
  // control on the encounter card stays: acting on advice should be one tap, and
  // taking it is now a choice the player makes rather than one already made.
  useEffect(() => {
    if (!encounter) {
      setResult(null);
      setSelectedSkill(null);
      return;
    }
    // WHAT THE PLAYER ROLLED HERE, not what the cell suggested.
    //
    // This lookup used to key on `encounter.skill`, which was harmless only
    // because the selection was the suggestion — the two could not disagree.
    // With the selection gone they can: roll `Lore` on a cell that suggests
    // `Scavenge`, walk away, walk back, and a suggestion-keyed lookup finds
    // nothing and silently forgets the outcome. Payment is per CELL; memory is
    // per cell AND skill, so the cell's own entry is what has to be found.
    const prior = [...resolved.current.entries()].find(([k]) =>
      k.startsWith(`${encounter.seed}|`)
    );
    setResult(prior?.[1] ?? null);
    // Reopening the resolved row is NOT a pre-selection (#63): the cell has
    // already paid, so nothing is being claimed — it is the record of a choice
    // the player made. An UNRESOLVED cell opens nothing, which is the case the
    // payout actually turns on.
    setSelectedSkill(
      prior ? ((prior[0].split('|')[1] || null) as SkillName | null) : null
    );
    // `encounter` itself, not its fields: it is memoised on [cell, dayKey],
    // so its identity is already stable and the linter can verify the
    // dependency instead of being told to trust a hand-picked subset.
  }, [encounter]);

  const begin = useCallback((name: string) => {
    const trimmed = name.trim();
    const c = generateCharacter(trimmed.length > 0 ? trimmed : 'Wanderer');
    saveCharacter(c);
    setCharacter(c);
  }, []);

  const regenerate = useCallback(() => {
    setCharacter((prev) => {
      const c = generateCharacter(prev?.name ?? 'Wanderer');
      saveCharacter(c);
      return c;
    });
    setResult(null);
    setSelectedSkill(null);
  }, []);

  const exportCharacter = useCallback(() => {
    if (!character || typeof window === 'undefined') return;
    const blob = new Blob([toExportJSON(character)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name.replace(/[^\w-]+/g, '-')}.geolarp.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Record it, so the sheet can tell the player whether a copy exists at the
    // moment they are about to destroy this one.
    setCharacter((prev) => {
      if (!prev) return prev;
      const next = markExported(prev);
      saveCharacter(next);
      return next;
    });
  }, [character]);

  /**
   * THE FIRST FIX ANCHORS. EVERY FIX AFTER IT MOVES THE CELL AND LEAVES THE ANCHOR (#140).
   *
   * Anchoring on every fix made `offset` permanently null for anyone actually walking,
   * because `cell` and `origin` were set to the same value in the same breath. The
   * distance readout and "Back to where I started" are both gated on `offset`
   * (CharacterPlay.tsx:373, :410), so the player who obeys the published promise — "a
   * game that only works if you move" — was the one the screen told nothing. Walk half a
   * mile, the design target in the post, and the app reported no metres and no bearing.
   * Grid movement, which the comment below calls armchair movement, had all of the
   * instrumentation.
   *
   * `anchorNextFix` is what makes this safe rather than a second lie. `setMode` anchors
   * to the CURRENT cell on every mode change (#150), so entering GPS from a zone would
   * otherwise leave `origin` sitting on the zone — pick Downtown Chattanooga, walk
   * outside in London, and the first fix would announce several thousand kilometres
   * "from where you started". The anchor for GPS has to be a place the player physically
   * was, so the first fix sets it and no later one does.
   */
  const setCellFromFix = useCallback((lat: number, lon: number) => {
    const c = cellOf(lat, lon);
    setCell(c);
    if (anchorNextFix.current) {
      // An anchor, because a fix is somewhere the player physically is.
      setOrigin(c);
      anchorNextFix.current = false;
    }
  }, []);

  /**
   * `step` MOVES THE CELL AND NEVER THE ORIGIN.
   *
   * That asymmetry is the entire point: grid movement is armchair movement,
   * and the distance from the place you actually anchored is the honest thing
   * to show. Anchoring on every step would make `offset` permanently zero and
   * the feedback permanently a lie.
   */
  const step = useCallback((direction: HexDirection) => {
    // `neighbour`, not raw index arithmetic. `CellGrid` renders the cells
    // `flower` returns but hands back the DIRECTION that produced them, so if
    // this walked the indices the tile a player taps and the cell they arrive in
    // would be different cells (#86).
    //
    // SIX DIRECTIONS, NOT EIGHT (#87). There is no due north on a pointy-top
    // lattice — the trade is six steps of one distance against four at 100 m and
    // four at 141 m.
    setCell((c) => (c ? neighbour(c, direction) : c));
  }, []);

  const resetToOrigin = useCallback(() => {
    setCell((c) => (origin ? origin : c));
  }, [origin]);

  /**
   * CHANGING MODE RE-ANCHORS, SO AN ARMCHAIR OFFSET CANNOT OUTLIVE ITS MODE (#150).
   *
   * The distance readout is gated on `offset` existing; the sentence that explains it
   * — "Grid movement walks the map, not you" — is gated on the MODE. Nothing cleared
   * the offset when the mode changed, so a player who stepped three tiles and then
   * pressed "Use my location" kept the distance and lost the explanation: the app told
   * someone who had not moved that they were 115 m from where they started. If they
   * denied the permission prompt, `geo.fix` stayed null, both effects early-returned,
   * and the stale value persisted for the whole session.
   *
   * The comment above that sentence names this exact state as the thing it exists to
   * prevent — "the alternative is a player believing the game thinks they walked
   * somewhere". A mode switch produced it.
   *
   * RE-ANCHOR ON THE CHANGE, NOT ON EVERY STEP. `step` moving the cell and never the
   * origin is the design above, and anchoring per step would make `offset` permanently
   * zero — a lie in the other direction. This anchors only when the player leaves the
   * mode that produced the offset, which is the moment the number stops meaning what
   * it said.
   *
   * Zone mode already happened to clear it, because picking a zone sets a cell. GPS did
   * not. Gating on the mode change rather than on GPS specifically is what stops a
   * third mode inheriting the bug.
   */
  const setMode = useCallback(
    (next: LocationMode) => {
      if (next === mode) return;
      // RE-ANCHOR, DO NOT CLEAR. Setting origin to null also kills
      // `resetToOrigin` — "Back to where I started" needs an anchor to return
      // to. Anchoring to the current cell makes `offset` null (cell === origin)
      // while leaving the player somewhere to go back to. The first version of
      // this fix nulled it and reddened five tests that depend on the anchor.
      setOrigin(cell);
      // GPS's anchor must be a place the player physically was, and `cell` here is
      // wherever the mode they are LEAVING had them. Defer it to the first fix (#140).
      anchorNextFix.current = next === 'gps';
      setModeState(next);
    },
    [mode, cell]
  );

  const offset = useMemo(
    () =>
      cell && origin && (cell.q !== origin.q || cell.r !== origin.r)
        ? offsetMetres(origin, cell)
        : null,
    [cell, origin]
  );

  const [earned, setEarned] = useState<number | null>(null);

  /**
   * Opening a row shows what THAT skill already did here, if anything.
   * Without this, switching rows would show the previous skill's dice under a
   * different name.
   */
  const selectSkill = useCallback(
    (skill: SkillName) => {
      setSelectedSkill(skill);
      setResult(
        encounter
          ? (resolved.current.get(keyFor(encounter.seed, skill)) ?? null)
          : null
      );
    },
    [encounter]
  );

  const resolve = useCallback(
    (r: RollResult, pointsSpent: number) => {
      setResult(r);
      if (!encounter) return;

      const stakeKey = `${encounter.seed}|${selectedSkill ?? ''}|${pointsSpent}`;
      // Identical dice must not be billed twice. Resolution is seeded from the
      // cell, so re-rolling at the same stake returns the same faces — charging
      // again for numbers the player has already seen would be a toll on
      // looking.
      const alreadyCharged = charged.current.has(stakeKey);
      charged.current.add(stakeKey);

      // One payout per cell per session, whatever the player rolls afterwards.
      // Payment is per CELL; memory is per cell AND skill, because an outcome
      // labelled with the wrong skill is worse than no memory at all.
      const firstResolution = ![...resolved.current.keys()].some((k) =>
        k.startsWith(`${encounter.seed}|`)
      );
      resolved.current.set(keyFor(encounter.seed, selectedSkill), r);
      const reward = firstResolution ? rewardFor(encounter.difficulty, r) : 0;
      setEarned(reward > 0 ? reward : null);

      const spend = alreadyCharged ? 0 : pointsSpent;
      if (spend <= 0 && reward <= 0) return;

      setCharacter((prev) => {
        if (!prev) return prev;
        /**
         * THE SECOND WALL.
         *
         * `spendCharacterPoints` throws on an over-spend and should — a library
         * that silently absorbs a bad argument is worse. But here that throw
         * runs inside a setState updater, where React surfaces it during commit
         * and the player gets a blank screen on the one route that holds their
         * character. The component clamps its stake; this clamps again, because
         * a crash on the character sheet is not an acceptable failure mode for
         * an arithmetic slip.
         */
        const affordable = Math.min(Math.max(0, spend), prev.characterPoints);
        // Spend BEFORE earning, so the daily cap sees the post-spend balance
        // and one act of play is one write. Both halves derive from `prev`, so
        // the updater stays idempotent under StrictMode's double invocation.
        const afterSpend =
          affordable > 0 ? spendCharacterPoints(prev, affordable) : prev;
        const next = earnCharacterPoints(afterSpend, reward, dayKey);
        if (next === prev) return prev;
        saveCharacter(next);
        return next;
      });
    },
    // Depending on `encounter` rather than two of its fields: the memo makes
    // it stable, and a hand-picked subset is exactly how a reward gets paid
    // against a stale encounter — the one real hazard in this change.
    [encounter, selectedSkill, dayKey]
  );

  return {
    character,
    ready,
    cell,
    origin,
    offset,
    encounter,
    selectedSkill,
    result,
    earned,
    mode,
    zoneId,
    begin,
    regenerate,
    exportCharacter,
    setMode,
    setZone: setZoneId,
    setCellFromFix,
    step,
    resetToOrigin,
    selectSkill,
    resolve,
  };
}

/** Re-exported so the component does not need a second import path. */
export { ratingFor };
