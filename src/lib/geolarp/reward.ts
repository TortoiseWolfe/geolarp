/**
 * What beating a cell pays.
 *
 * THE LOOP WAS OPEN AT BOTH ENDS. `resolve` never read `result.success`, so a
 * win and a loss were the same state transition — two different sentences over
 * an identical outcome. And `spendCharacterPoints` was a one-way valve: five
 * points per character, ever, with no code path anywhere that increased the
 * balance. A playtester found both in one session, on a Heroic cell a starting
 * sheet cannot beat.
 *
 * `resolution.md:123` marks how the currency is earned as UNSPECIFIED. This
 * file DECIDES it, and says so: the sink shipped without a source, and a game
 * whose only resource is finite is a game that ends quietly.
 *
 * WHAT LOSING COSTS. `resolution.md:139` declines damage, wounds and any
 * consequence track, and that is not overturned here. The cost of failing is
 * OPPORTUNITY: you walked here, the cell's roll is fixed until midnight, and
 * you got nothing for it. That needs no consequence track and — importantly —
 * no record of where you have been.
 */
import { Difficulty } from './ladder';
import { RollResult } from './dice';

/**
 * Points paid for beating a cell, by band.
 *
 * DECIDED, not published. Trivial cells pay nothing on purpose: 35% of the
 * world is Very Easy or Easy (`encounter.ts:93-100`) and a starting character
 * clears those almost always, so paying for them would make walking to the
 * nearest cell the optimal strategy rather than walking anywhere interesting.
 */
export const REWARD_BY_BAND: Readonly<Record<Difficulty, number>> = {
  'very-easy': 0,
  easy: 0,
  moderate: 1,
  difficult: 1,
  'very-difficult': 2,
  heroic: 3,
} as const;

/** The most a character can earn in one UTC day. See `earnCharacterPoints`. */
export const DAILY_EARN_CAP = 5;

/**
 * What this roll pays, before the daily cap is applied.
 *
 * THIS IS THE FIRST CONSUMER OF `Outcome`. `dice.ts:104-105` has always
 * computed whether the wild die exploded or complicated, and until now that
 * fed exactly two strings and nothing else — the card said "take the better of
 * what follows" and "something goes wrong either way" while neither meant
 * anything. Both are now true statements about the economy.
 */
export function rewardFor(difficulty: Difficulty, result: RollResult): number {
  // `success` is optional on RollResult because it only exists when a
  // difficulty was supplied. An encounter always supplies one; be defensive
  // anyway, because a missing target must never read as a win.
  if (result.success !== true) return 0;

  const base = REWARD_BY_BAND[difficulty];

  // A complication pays nothing even on a success. This is what finally makes
  // `EncounterCard`'s "something goes wrong either way" a rule rather than
  // flavour text: you got past it, and you learned nothing from it.
  if (result.outcome === 'complication') return 0;

  // An exploding wild die pays one more — but only where something was already
  // owed. GATING ON A NONZERO BASE IS LOAD-BEARING: ungated, the 35% of cells
  // that pay nothing would still pay 0.14 each from the 1-in-7 wild seven
  // alone, turning a third of the map into a slot machine you work rather than
  // a place you walk. Simulated over 400k encounters: 0.32 points each
  // ungated against 0.27 gated, and the entire difference comes from cells
  // that are supposed to be beneath notice.
  if (result.outcome === 'critical' && base > 0) return base + 1;

  return base;
}
