'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Character,
  CharacterStore,
  HistoryEntry,
  SkillName,
  earnCharacterPoints,
  markExported,
  spendCharacterPoints,
  toExportJSON,
  withHistory,
} from '@/lib/geolarp/character';
import { utcDay } from '@/lib/geolarp/cell';
import { Difficulty, bandOf } from '@/lib/geolarp/ladder';
import { RollResult } from '@/lib/geolarp/dice';
import { rewardFor } from '@/lib/geolarp/reward';
import {
  Library,
  activeCharacter,
  addCharacter,
  defaultStore,
  exportFileName,
  importCharacterFile,
  loadLibrary,
  removeCharacter,
  saveLibrary,
  selectCharacter,
  updateCharacter,
} from '@/lib/geolarp/library';

export interface UsePlaySheetReturn {
  /** False until the browser's storage has been read. */
  ready: boolean;
  library: Library;
  character: Character | null;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  selectedSkill: SkillName | null;
  selectSkill: (skill: SkillName) => void;
  /** The seed for the open roll, fixed per character, skill, difficulty and day. */
  seed: string | null;
  result: RollResult | null;
  /** Points paid by the latest resolution, or null. */
  earned: number | null;
  /** Points still earnable today. */
  today: string;
  /** A full library, or a bad file, said in plain words. */
  notice: string | null;
  clearNotice: () => void;
  addNew: (char: Character) => boolean;
  select: (id: string) => void;
  remove: (id: string) => void;
  resolve: (result: RollResult, pointsSpent: number) => void;
  /** Download the active character as a file and record that it was exported. */
  exportActive: () => void;
  /** Read a chosen file. Returns the character when it would replace one already held. */
  importText: (
    text: string
  ) => { replaces: Character | null; char: Character } | null;
  /** Commit an import the player has confirmed. */
  commitImport: (char: Character) => void;
}

const DOWNLOAD_NOT_AVAILABLE =
  'This browser cannot save a file here. Copy the sheet from a different browser.';

/**
 * Everything the MVP play sheet needs: the library, the active character, and
 * the roll loop against a difficulty the player picks.
 *
 * NO LOCATION, NO NETWORK. The roll has no cell behind it. Its seed is the
 * character, the skill, the difficulty and the UTC day, so the first roll is
 * fixed until midnight (re-rolling the same thing is pointless rather than
 * forbidden, the same design the encounter roll uses) and a payout is bounded by
 * the daily cap exactly as the merged code runs it.
 */
export function usePlaySheet(
  today: Date = new Date(),
  store: CharacterStore | undefined = undefined
): UsePlaySheetReturn {
  const [ready, setReady] = useState(false);
  const [library, setLibrary] = useState<Library>({
    version: 1,
    activeId: null,
    characters: [],
  });
  const [difficulty, setDifficultyState] = useState<Difficulty>('moderate');
  const [selectedSkill, setSelectedSkill] = useState<SkillName | null>(null);
  const [result, setResult] = useState<RollResult | null>(null);
  const [earned, setEarned] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const storeRef = useRef<CharacterStore | undefined>(store);

  const day = utcDay(today);
  const character = activeCharacter(library);

  useEffect(() => {
    storeRef.current = store ?? defaultStore();
    if (storeRef.current) setLibrary(loadLibrary(storeRef.current));
    setReady(true);
  }, [store]);

  const commit = useCallback((next: Library) => {
    setLibrary(next);
    if (storeRef.current) saveLibrary(next, storeRef.current);
  }, []);

  // One map per page load, as in the encounter loop: a durable record of what
  // has paid is a ledger of activity, and the daily cap is what makes forgetting
  // it on reload safe.
  const resolved = useRef(new Map<string, RollResult>());
  const charged = useRef(new Map<string, number>());
  const paid = useRef(new Set<string>());

  const rollKey = useCallback(
    (skill: SkillName | null, d: Difficulty, c: Character | null) =>
      `practice|${day}|${c?.created ?? ''}|${skill ?? ''}|${d}`,
    [day]
  );

  const seed = useMemo(
    () =>
      selectedSkill && character
        ? rollKey(selectedSkill, difficulty, character)
        : null,
    [selectedSkill, difficulty, character, rollKey]
  );

  const selectSkill = useCallback(
    (skill: SkillName) => {
      setSelectedSkill((open) => (open === skill ? null : skill));
      setResult(
        character
          ? (resolved.current.get(rollKey(skill, difficulty, character)) ??
              null)
          : null
      );
      setEarned(null);
    },
    [character, difficulty, rollKey]
  );

  const setDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficultyState(d);
      setResult(
        character && selectedSkill
          ? (resolved.current.get(rollKey(selectedSkill, d, character)) ?? null)
          : null
      );
      setEarned(null);
    },
    [character, selectedSkill, rollKey]
  );

  const resolve = useCallback(
    (r: RollResult, pointsSpent: number) => {
      setResult(r);
      if (!character || !selectedSkill) return;

      const key = rollKey(selectedSkill, difficulty, character);
      const billed = charged.current.get(key) ?? 0;
      const spend = Math.max(0, pointsSpent - billed);
      charged.current.set(key, Math.max(billed, pointsSpent));
      resolved.current.set(key, r);

      // Pays the first WIN on this roll, as the encounter loop pays a cell's.
      const firstWin = r.success === true && !paid.current.has(key);
      if (firstWin) paid.current.add(key);
      const reward = firstWin ? rewardFor(difficulty, r) : 0;
      setEarned(reward > 0 ? reward : null);

      if (spend <= 0 && reward <= 0 && !firstWin) return;

      const label = bandOf(difficulty).label;
      const entries: HistoryEntry[] = [];
      const affordable = Math.min(
        Math.max(0, spend),
        character.characterPoints
      );
      if (affordable > 0) {
        const bought = (r.purchases ?? []).slice(-affordable);
        entries.push({
          day,
          skill: selectedSkill,
          change: -affordable,
          note:
            bought.length > 0
              ? `Spent on ${bought.map((p) => (p === 'die' ? 'an extra die' : 'a reroll')).join(' and ')}`
              : 'Spent on a second chance',
        });
      }

      const afterSpend =
        affordable > 0
          ? spendCharacterPoints(character, affordable)
          : character;
      const afterEarn = earnCharacterPoints(afterSpend, reward, day);
      const gained = afterEarn.characterPoints - afterSpend.characterPoints;
      if (firstWin) {
        entries.push({
          day,
          skill: selectedSkill,
          change: gained,
          note:
            reward === 0
              ? `Won a ${label} roll. It pays nothing, on purpose.`
              : gained < reward
                ? `Won a ${label} roll. Today's cap of points was reached.`
                : `Won a ${label} roll`,
        });
      }
      const next = withHistory(afterEarn, entries);
      if (next === character) return;
      commit(updateCharacter(library, next));
    },
    [character, selectedSkill, difficulty, rollKey, day, library, commit]
  );

  const exportActive = useCallback(() => {
    if (!character) return;
    try {
      const blob = new Blob([toExportJSON(character)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(character);
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(DOWNLOAD_NOT_AVAILABLE);
      return;
    }
    commit(updateCharacter(library, markExported(character)));
  }, [character, library, commit]);

  const importText = useCallback(
    (text: string) => {
      try {
        const char = importCharacterFile(text);
        const replaces =
          library.characters.find((c) => c.created === char.created) ?? null;
        return { replaces, char };
      } catch (e) {
        setNotice((e as Error).message);
        return null;
      }
    },
    [library]
  );

  const addNew = useCallback(
    (char: Character) => {
      const next = addCharacter(library, char);
      if (!next) {
        setNotice(
          'This device holds 20 characters, the most. Export one you want to keep, then remove it.'
        );
        return false;
      }
      setSelectedSkill(null);
      setResult(null);
      setEarned(null);
      commit(next);
      return true;
    },
    [library, commit]
  );

  const commitImport = useCallback(
    (char: Character) => {
      // NOT marked as exported: `exportedAt` is about THIS browser, and a
      // sheet that just arrived here has never been exported from it.
      addNew(char);
    },
    [addNew]
  );

  const select = useCallback(
    (id: string) => {
      setSelectedSkill(null);
      setResult(null);
      setEarned(null);
      commit(selectCharacter(library, id));
    },
    [library, commit]
  );

  const remove = useCallback(
    (id: string) => {
      setSelectedSkill(null);
      setResult(null);
      commit(removeCharacter(library, id));
    },
    [library, commit]
  );

  return {
    ready,
    library,
    character,
    difficulty,
    setDifficulty,
    selectedSkill,
    selectSkill,
    seed,
    result,
    earned,
    today: day,
    notice,
    clearNotice: () => setNotice(null),
    addNew,
    select,
    remove,
    resolve,
    exportActive,
    importText,
    commitImport,
  };
}
