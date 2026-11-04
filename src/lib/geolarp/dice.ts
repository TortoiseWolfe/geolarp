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

/** What a Character Point buys, AFTER the dice are down. */
export type Purchase = 'die' | 'reroll';

/**
 * One Character Point per purchase, for an extra die and a reroll alike.
 *
 * Neither is priced double: the council's statistician argued a die is worth
 * about 1.5 rerolls and should cost two, but that counts rescued failures, and
 * the reward returned per point spent is within 15% either way. Jonathan ruled
 * one point each (4 Nov 2026).
 */
export const PURCHASE_COST = 1;

/**
 * The most Character Points one roll can take, across both options together.
 * A third point on one roll returns 0.15-0.3 reward per point spent at best.
 */
export const MAX_POINTS_PER_ROLL = 2;

export type Outcome = 'critical' | 'complication' | 'normal';

export interface RollResult {
  /** Every die face rolled, wild die first, including explosions. */
  faces: number[];
  /** Sum of faces plus pips. */
  total: number;
  pips: number;
  /** Extra dice bought with Character Points on this roll (a reroll keeps them). */
  bonusDice: number;
  /**
   * What the player bought after the roll, in order. Absent on a roll nobody
   * has bought anything for. Each entry costs `PURCHASE_COST`.
   */
  purchases?: Purchase[];
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
   * Extra ordinary dice already on the table. `roll` itself is unchanged by the
   * move to buying after the roll: a reroll calls it with the dice the player
   * bought earlier, and `buy` adds the dice one at a time. They are ordinary
   * dice, because only the Wild Die explodes, so extra dice raise the floor
   * rather than the ceiling.
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

/** Points this roll has cost so far. */
export function pointsSpent(r: RollResult): number {
  return (r.purchases ?? []).length * PURCHASE_COST;
}

export type PurchaseRefusal = 'no-roll' | 'won' | 'cap' | 'broke';

/**
 * Why a purchase is not on offer, or null if it is.
 *
 * - `no-roll`: nothing is bought before the dice are down.
 * - `won`: the roll already beat the cell. A purchase could only spoil it (a
 *   reroll can lose a win), and the first win has already paid.
 * - `cap`: `MAX_POINTS_PER_ROLL` spent on this roll.
 * - `broke`: the player holds fewer than one point.
 *
 * A roll with no target has no `success` and so is never `won`: without a
 * difficulty there is no miss to fix, and the caller decides what that means.
 */
export function purchaseRefusal(
  r: RollResult | null,
  balance: number
): PurchaseRefusal | null {
  if (!r) return 'no-roll';
  if (r.success === true) return 'won';
  if (pointsSpent(r) + PURCHASE_COST > MAX_POINTS_PER_ROLL) return 'cap';
  if (balance < PURCHASE_COST) return 'broke';
  return null;
}

/**
 * The RNG seed for the nth purchase on a cell's roll (n counts from 1).
 *
 * Rolls are pure functions of the cell seed, and so are purchases: the same cell
 * and the same purchases in the same order always give the same dice. A player
 * cannot reload to try a different die, and a cell that is left and re-entered
 * replays what was bought rather than selling it again. Order matters (die then
 * reroll is a different roll from reroll then die) because the index and the
 * kind are both in the seed.
 */
export function purchaseSeed(
  seed: string,
  kind: Purchase,
  index: number
): string {
  return `${seed}|${kind}|${index}`;
}

/**
 * Buy one thing for one point and return the new state of the roll.
 *
 * - `die`: one more ORDINARY d7 joins the dice on the table. The wild die is
 *   the one already rolled, so a bought die cannot explode or complicate.
 * - `reroll`: the whole pool is rolled again, wild die included, with any
 *   bought dice kept. The old roll is gone.
 *
 * Throws on a refused purchase rather than quietly doing something else; the
 * caller checks `purchaseRefusal` first. Balance is the caller's concern.
 */
export function buy(
  code: DiceCode,
  prior: RollResult,
  kind: Purchase,
  rng: Rng,
  difficulty?: number
): RollResult {
  if (prior.success === true) {
    throw new Error('the roll already beat the cell; nothing to buy');
  }
  if (pointsSpent(prior) + PURCHASE_COST > MAX_POINTS_PER_ROLL) {
    throw new Error(
      `at most ${MAX_POINTS_PER_ROLL} Character Points on one roll`
    );
  }
  const purchases = [...(prior.purchases ?? []), kind];

  if (kind === 'reroll') {
    return {
      ...roll(code, rng, difficulty, prior.bonusDice),
      purchases,
    };
  }

  const face = rng.int(1, 7);
  const total = prior.total + face;
  return {
    ...prior,
    faces: [...prior.faces, face],
    total,
    bonusDice: prior.bonusDice + 1,
    purchases,
    ...(difficulty === undefined ? {} : { success: total >= difficulty }),
  };
}

/**
 * Rebuild a roll's state from the cell seed: the base roll plus every purchase,
 * in order. What a restored cell, and a second press of Roll, show.
 */
export function replayPurchases(
  code: DiceCode,
  base: RollResult,
  seed: string,
  purchases: readonly Purchase[],
  difficulty?: number
): RollResult {
  let r = base;
  purchases.forEach((kind, i) => {
    r = buy(
      code,
      r,
      kind,
      new Rng(purchaseSeed(seed, kind, i + 1)),
      difficulty
    );
  });
  return r;
}
