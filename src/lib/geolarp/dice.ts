/**
 * The d7 system — West End Games' D6 with a seven-sided die.
 *
 * Ratings are dice codes with pips: `3d7+2` rolls three d7, sums them, adds 2.
 * `3 pips = 1D`, so `Xd7+3` is not a rating — it is `(X+1)d7`.
 *
 * See `features/enhancements/052-character-model/resolution.md` for the
 * conversion and its arithmetic, and `spec.md` for what the blog published.
 */
import { Rng } from './rng';

export const PIPS_PER_DIE = 3;

export interface DiceCode {
  /** Whole dice. */
  dice: number;
  /** 0, 1 or 2 — never 3, which is another die. */
  pips: number;
}

/** Normalises pip overflow: 2d7+3 is 3d7. */
export function normalise(code: DiceCode): DiceCode {
  const total = code.dice * PIPS_PER_DIE + code.pips;
  return {
    dice: Math.floor(total / PIPS_PER_DIE),
    pips: total % PIPS_PER_DIE,
  };
}

export function formatCode(code: DiceCode): string {
  const n = normalise(code);
  return n.pips > 0 ? `${n.dice}d7+${n.pips}` : `${n.dice}d7`;
}

/** Total pips, for comparing or advancing ratings. */
export function toPips(code: DiceCode): number {
  return code.dice * PIPS_PER_DIE + code.pips;
}

export function fromPips(pips: number): DiceCode {
  return normalise({ dice: 0, pips });
}

export type Outcome = 'critical' | 'complication' | 'normal';

export interface RollResult {
  /** Every die face rolled, wild die first, including explosions. */
  faces: number[];
  /** Sum of faces plus pips. */
  total: number;
  pips: number;
  /** Dice bought with Character Points for this roll. */
  bonusDice: number;
  /** The wild die's FIRST face — what `:44` and `:49` key on. */
  wild: number;
  outcome: Outcome;
  /** Present only when a difficulty was supplied. */
  success?: boolean;
}

/**
 * Roll a dice code, optionally against a difficulty number.
 *
 * THE WILD DIE. One die in the pool is wild. On a 7 it explodes — add it and
 * roll again, repeating while it shows 7. On a 1 it complicates.
 *
 * A CRITICAL IS THE WILD DIE'S FIRST FACE SHOWING 7 — 1/7, exactly the 14.29%
 * published at `:44`. Counting the whole exploding chain instead would give
 * (1/7)/(1-1/7) = 16.67%, which is a different number from the one on the page.
 */
export function roll(
  code: DiceCode,
  rng: Rng = new Rng(Math.floor(Math.random() * 0xffffffff)),
  difficulty?: number,
  /**
   * Extra dice bought with Character Points, as in D6. They are ordinary dice:
   * only the Wild Die explodes, so spending points raises the floor rather
   * than the ceiling. This is what gives a player any agency on a cell rated
   * above their sheet.
   */
  bonusDice = 0
): RollResult {
  const n = normalise(code);
  if (n.dice < 1) {
    throw new Error(`a rating needs at least one die, got ${formatCode(n)}`);
  }

  const faces: number[] = [];

  // The wild die, first, so `faces[0]` is always the one the rules key on.
  const wild = rng.int(1, 7);
  faces.push(wild);
  let last = wild;
  while (last === 7) {
    last = rng.int(1, 7);
    faces.push(last);
  }

  for (let i = 1; i < n.dice + bonusDice; i += 1) {
    faces.push(rng.int(1, 7));
  }

  const total = faces.reduce((a, b) => a + b, 0) + n.pips;
  const outcome: Outcome =
    wild === 7 ? 'critical' : wild === 1 ? 'complication' : 'normal';

  return {
    faces,
    total,
    pips: n.pips,
    bonusDice,
    wild,
    outcome,
    ...(difficulty === undefined ? {} : { success: total >= difficulty }),
  };
}
