/**
 * Difficulty ladder, rescaled from D6's by x8/7.
 *
 * D6's bands assume a 3.5 average per die. A d7 averages 4.0, so every band
 * floor moves by 8/7 or the whole table means something else. Calibration
 * check: D6's benchmark is 3d6 vs Moderate (11+) at 50.0%; 3d7 vs 13+ is 44.6%.
 *
 * The bands are CONTIGUOUS. Rounding each D6 floor independently leaves a hole
 * (6 -> 6.86 -> 7 and 11 -> 12.57 -> 13 skips 12), so each band runs up to the
 * next band's floor minus one.
 */
export type Difficulty =
  | 'very-easy'
  | 'easy'
  | 'moderate'
  | 'difficult'
  | 'very-difficult'
  | 'heroic';

export interface Band {
  id: Difficulty;
  label: string;
  /** Inclusive lower bound. The band runs to the next floor minus one. */
  floor: number;
}

export const LADDER: readonly Band[] = [
  { id: 'very-easy', label: 'Very Easy', floor: 2 },
  { id: 'easy', label: 'Easy', floor: 7 },
  { id: 'moderate', label: 'Moderate', floor: 13 },
  { id: 'difficult', label: 'Difficult', floor: 18 },
  { id: 'very-difficult', label: 'Very Difficult', floor: 24 },
  { id: 'heroic', label: 'Heroic', floor: 35 },
] as const;

export function bandOf(id: Difficulty): Band {
  const band = LADDER.find((b) => b.id === id);
  if (!band) throw new Error(`unknown difficulty: ${id}`);
  return band;
}

/** Inclusive range for a band; `null` upper bound means open-ended. */
export function rangeOf(id: Difficulty): { lo: number; hi: number | null } {
  const i = LADDER.findIndex((b) => b.id === id);
  if (i < 0) throw new Error(`unknown difficulty: ${id}`);
  const next = LADDER[i + 1];
  return { lo: LADDER[i].floor, hi: next ? next.floor - 1 : null };
}

/**
 * What a roll must reach, as a floor.
 *
 * THE BAND RANGE IS NOT A SUCCESS WINDOW, and printing it as one was a real
 * defect. `roll()` resolves `success: total >= difficulty`, and every caller
 * passes `bandOf(id).floor` — so a Moderate check succeeds at 13 AND at 30.
 * The UI printed "Target: Moderate (13-17)", which states a window the rules do
 * not have and implies 18 overshoots. Use this wherever a player is being told
 * what to beat; `formatBand` is for rating the CELL, not the roll.
 */
export function formatTarget(id: Difficulty): string {
  return `${bandOf(id).floor} or more`;
}

export function formatBand(id: Difficulty): string {
  const { lo, hi } = rangeOf(id);
  return `${bandOf(id).label} (${hi === null ? `${lo}+` : `${lo}-${hi}`})`;
}
