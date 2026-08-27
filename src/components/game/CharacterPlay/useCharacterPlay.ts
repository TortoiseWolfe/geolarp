import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '@/lib/geolarp/character';
import { Cell, cellOf, seedOf } from '@/lib/geolarp/cell';
import { Encounter, encounterFor } from '@/lib/geolarp/encounter';
import { RollResult } from '@/lib/geolarp/dice';

/**
 * How the player's cell is decided.
 *
 * All three are published commitments: "Deny the permission entirely and it
 * still plays: it falls back to a coarse network location, a zone you pick by
 * hand, or grid movement with no GPS at all"
 * (`the-world-is-the-board.md:93-95`).
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
  encounter: Encounter | null;
  selectedSkill: SkillName | null;
  result: RollResult | null;
  mode: LocationMode;
  zoneId: string;
  begin: (name: string) => void;
  regenerate: () => void;
  exportCharacter: () => void;
  setMode: (mode: LocationMode) => void;
  setZone: (id: string) => void;
  setCellFromFix: (lat: number, lon: number) => void;
  step: (dx: number, dy: number) => void;
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
    setCell(cellOf(zone.lat, zone.lon));
  }, [mode, zoneId]);

  useEffect(() => {
    if (mode !== 'grid' || cell) return;
    // Grid play needs somewhere to start; the first zone will do.
    setCell(cellOf(ZONES[1].lat, ZONES[1].lon));
  }, [mode, cell]);

  const dayKey = today.toISOString().slice(0, 10);
  const encounter = useMemo(
    () =>
      cell ? encounterFor(seedOf(cell, new Date(`${dayKey}T12:00:00Z`))) : null,
    [cell, dayKey]
  );

  // A new cell is a new encounter, so nothing from the last one may linger.
  //
  // The selection RESETS TO THE ENCOUNTER'S OWN SUGGESTION rather than to null.
  // The skill is already computed (`encounter.skill`) and already shown as
  // advice; opening it means the common path — roll what the cell asks for —
  // costs no taps at all, while every other row stays one tap away.
  useEffect(() => {
    setResult(null);
    setSelectedSkill(encounter?.skill ?? null);
  }, [encounter?.seed, encounter?.skill]);

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

  const setCellFromFix = useCallback((lat: number, lon: number) => {
    setCell(cellOf(lat, lon));
  }, []);

  const step = useCallback((dx: number, dy: number) => {
    setCell((c) => (c ? { x: c.x + dx, y: c.y + dy } : c));
  }, []);

  const resolve = useCallback((r: RollResult, pointsSpent: number) => {
    setResult(r);
    if (pointsSpent > 0) {
      setCharacter((prev) => {
        if (!prev) return prev;
        const next = spendCharacterPoints(prev, pointsSpent);
        saveCharacter(next);
        return next;
      });
    }
  }, []);

  return {
    character,
    ready,
    cell,
    encounter,
    selectedSkill,
    result,
    mode,
    zoneId,
    begin,
    regenerate,
    exportCharacter,
    setMode: setModeState,
    setZone: setZoneId,
    setCellFromFix,
    step,
    selectSkill: setSelectedSkill,
    resolve,
  };
}

/** Re-exported so the component does not need a second import path. */
export { ratingFor };
