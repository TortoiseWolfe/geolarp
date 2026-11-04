import { describe, it, expect } from 'vitest';
import { successChance } from '@/lib/geolarp/odds';
import { LADDER, Difficulty } from '@/lib/geolarp/ladder';
import { REWARD_BY_BAND, DAILY_EARN_CAP } from '@/lib/geolarp/reward';
import { DIFFICULTY_WEIGHTS } from '@/lib/geolarp/encounter';

/**
 * The economy's stated invariants, enumerated rather than sampled.
 *
 * WHY THIS FILE EXISTS. `resolution.md` asserted "**No stake is farming-positive**"
 * and cited one case. That sentence was written from a sample, not from the
 * space, and it was false. Character Points are a sink funded by walking
 * rather than something a stationary player can grind; that is why a daily CAP
 * was chosen over a daily stipend, so the claim has to be stated as measured
 * and owned by a test.
 *
 * THE RULE IT MEASURES (Jonathan's ruling, 4 Nov 2026). A Character Point is
 * spent AFTER the roll, only on a miss, to buy an extra die or a reroll, and
 * the payout is for the first WIN. So a point costs nothing on a roll that
 * already won, and what one point buys is the chance to turn a miss into a win:
 *
 *   spent per roll   = P(miss)
 *   die    gains     = reward with one more ordinary die  - reward as rolled
 *   reroll gains     = P(miss) x reward of a fresh roll
 *
 * "Return" below is reward gained per point spent, weighed by how often the
 * world serves each band (`DIFFICULTY_WEIGHTS`). A return above 1 would mean a
 * point pays for itself.
 */

/**
 * The sum of `n` ORDINARY d7 — no wild die, no explosions.
 *
 * Derived here rather than imported: `odds.ts` only ever exposes the full pool
 * including the wild die, and this file needs to condition ON the wild die's
 * face. Deriving it independently is also the point — the test below checks
 * that this reconstruction reproduces `successChance` exactly, so two separate
 * derivations have to agree before any conclusion is drawn from either.
 */
function ordinaryAtLeast(n: number, need: number): number {
  let dist = [1];
  for (let i = 0; i < n; i += 1) {
    const out = new Array<number>(dist.length + 7).fill(0);
    for (let v = 0; v < dist.length; v += 1) {
      for (let f = 1; f <= 7; f += 1) out[v + f] += dist[v] / 7;
    }
    dist = out;
  }
  return dist.reduce((acc, p, v) => (v >= need ? acc + p : acc), 0);
}

/**
 * Expected Character Points from one roll, CONDITIONED ON THE WILD DIE'S FIRST FACE.
 * `bought` is the number of extra ordinary dice added to the pool.
 *
 * The conditioning is not a refinement, it is the difference between right and
 * wrong. A critical explodes, so it RAISES the total, so success and "the wild
 * die showed 7" are positively correlated. Treating them as independent — the
 * first thing anyone writes — understated the edge here by a factor of about
 * four (+0.045 against the true +0.175). Two independent passes disagreed and
 * the correlated one was correct.
 *
 * Payout gates, from `reward.ts`: a complication (first face 1) pays nothing
 * even on a success; a critical (first face 7) pays base + 1, but only where
 * the base is already nonzero.
 */
function expectedReward(
  dice: number,
  pips: number,
  band: Difficulty,
  bought: number
): number {
  const target = LADDER.find((b) => b.id === band)!.floor;
  const base = REWARD_BY_BAND[band];
  const ordinary = dice + bought - 1;

  let ev = 0;
  for (let face = 1; face <= 6; face += 1) {
    const pSuccess = ordinaryAtLeast(ordinary, target - face - pips);
    ev += (1 / 7) * pSuccess * (face === 1 ? 0 : base);
  }
  // First face 7: the die explodes, so the rest of the pool needs only
  // `target - 7`, and what follows is another full wild draw.
  const pCritical = successChance({ dice, pips }, target - 7, bought);
  ev += (1 / 7) * pCritical * (base > 0 ? base + 1 : 0);
  return ev;
}

const POOLS = [2, 3, 4, 5, 6];
const PAID_BANDS = LADDER.filter((b) => REWARD_BY_BAND[b.id] > 0);

/** What buying after a miss gains, and how often a point is spent at all. */
function purchase(dice: number, band: Difficulty) {
  const target = LADDER.find((b) => b.id === band)!.floor;
  const missed = 1 - successChance({ dice, pips: 0 }, target);
  const asRolled = expectedReward(dice, 0, band, 0);
  return {
    missed,
    dieGain: expectedReward(dice, 0, band, 1) - asRolled,
    rerollGain: missed * asRolled,
  };
}

/** Reward back per point spent, over the world's band mix (Moderate and up). */
function mixedReturn(dice: number): { die: number; reroll: number } {
  let spent = 0;
  let die = 0;
  let reroll = 0;
  for (const [band, weight] of DIFFICULTY_WEIGHTS) {
    if (REWARD_BY_BAND[band] === 0) continue;
    const p = purchase(dice, band);
    spent += weight * p.missed;
    die += weight * p.dieGain;
    reroll += weight * p.rerollGain;
  }
  return { die: die / spent, reroll: reroll / spent };
}

describe('the economy invariants, enumerated', () => {
  it('reconstructs successChance from the wild die outward', () => {
    // If these two derivations disagree, nothing below this line means anything.
    for (const [dice, target] of [
      [3, 13],
      [4, 18],
      [2, 7],
      [5, 24],
    ] as const) {
      let rebuilt = 0;
      for (let face = 1; face <= 6; face += 1) {
        rebuilt += (1 / 7) * ordinaryAtLeast(dice - 1, target - face);
      }
      rebuilt += (1 / 7) * successChance({ dice, pips: 0 }, target - 7, 0);
      expect(rebuilt).toBeCloseTo(successChance({ dice, pips: 0 }, target), 10);
    }
  });

  it('returns less than a point per point over the whole world, at every pool', () => {
    // The council's figures (reward back per point, die / reroll):
    //   3d7 0.34 / 0.29    4d7 0.43 / 0.44    5d7 0.56 / 0.62
    // A player who spends every point they hold on every miss loses points.
    const expected: Array<[number, number, number]> = [
      [3, 0.335, 0.293],
      [4, 0.429, 0.435],
      [5, 0.557, 0.617],
    ];
    for (const [dice, die, reroll] of expected) {
      const r = mixedReturn(dice);
      expect(r.die).toBeCloseTo(die, 2);
      expect(r.reroll).toBeCloseTo(reroll, 2);
    }
    for (const dice of POOLS) {
      const r = mixedReturn(dice);
      expect(r.die).toBeLessThan(1);
      expect(r.reroll).toBeLessThan(1);
    }
  });

  it('finds one purchase that pays for itself: a 6d7 reroll against Very Difficult', () => {
    // The corrected invariant, stated as measured. Walking the whole grid (pools
    // 2 to 6, every paying band, both options) exactly one cell returns more
    // than the point it costs. `resolution.md` used to say no stake farms.
    const positive: string[] = [];
    for (const dice of POOLS) {
      for (const band of PAID_BANDS) {
        const p = purchase(dice, band.id);
        if (p.dieGain / p.missed > 1) positive.push(`${dice}d7|${band.id}|die`);
        if (p.rerollGain / p.missed > 1) {
          positive.push(`${dice}d7|${band.id}|reroll`);
        }
      }
    }
    expect(positive).toEqual(['6d7|very-difficult|reroll']);
  });

  it('prices that edge, so a change to any input is visible here', () => {
    const p = purchase(6, 'very-difficult');
    expect(p.rerollGain / p.missed).toBeCloseTo(1.175, 2);
    expect(p.dieGain / p.missed).toBeCloseTo(0.917, 2);
  });

  it('keeps the edge unreachable at creation, which is what bounds it', () => {
    // 6d7 is the best a starting sheet can reach (4d7 attribute + a 2D focus),
    // and only on one skill; Very Difficult is 12% of cells; and two points at
    // most go on any one roll. DAILY_EARN_CAP closes the loop: even a player
    // who found the edge cannot bank more than five a day.
    expect(DAILY_EARN_CAP).toBe(5);
    // Everything below 6d7 is strictly under one at every paying band.
    for (const dice of [2, 3, 4, 5]) {
      for (const band of PAID_BANDS) {
        const p = purchase(dice, band.id);
        expect(p.dieGain / p.missed).toBeLessThan(1);
        expect(p.rerollGain / p.missed).toBeLessThan(1);
      }
    }
  });

  it('never pays for a trivial cell, however many points are bought', () => {
    // The gate that stops a third of the map being a slot machine.
    for (const dice of POOLS) {
      for (const bought of [0, 1, 2]) {
        expect(expectedReward(dice, 0, 'very-easy', bought)).toBe(0);
        expect(expectedReward(dice, 0, 'easy', bought)).toBe(0);
      }
    }
  });
});
