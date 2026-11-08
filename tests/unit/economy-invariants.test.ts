import { describe, it, expect } from 'vitest';
import { successChance } from '@/lib/geolarp/odds';
import { LADDER, Difficulty } from '@/lib/geolarp/ladder';
import { REWARD_BY_BAND, DAILY_EARN_CAP } from '@/lib/geolarp/reward';

/**
 * The economy's stated invariants, enumerated rather than sampled.
 *
 * WHY THIS FILE EXISTS. `resolution.md` asserted "**No stake is farming-positive**"
 * and cited one case — 0.55 gross at a stake of 2. The sentence was written from
 * that sample, not from the space, and it is false: at `5d7` and above against a
 * Very Difficult cell, a stake of 1 has positive expected value.
 *
 * That claim is load-bearing. The economy section uses it to argue Character
 * Points are a sink funded by walking rather than something a stationary player
 * can grind, which is the reason a daily CAP was chosen over a daily stipend.
 * A premise that fails at the top of the pool range needs to be stated as
 * measured, and then owned by a test so it cannot drift back into a slogan.
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
  stake: number
): number {
  const target = LADDER.find((b) => b.id === band)!.floor;
  const base = REWARD_BY_BAND[band];
  const ordinary = dice + stake - 1;

  let ev = 0;
  for (let face = 1; face <= 6; face += 1) {
    const pSuccess = ordinaryAtLeast(ordinary, target - face - pips);
    ev += (1 / 7) * pSuccess * (face === 1 ? 0 : base);
  }
  // First face 7: the die explodes, so the rest of the pool needs only
  // `target - 7`, and what follows is another full wild draw.
  const pCritical = successChance({ dice, pips }, target - 7, stake);
  ev += (1 / 7) * pCritical * (base > 0 ? base + 1 : 0);
  return ev;
}

const POOLS = [2, 3, 4, 5, 6];
const STAKES = [1, 2, 3, 4, 5];

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

  it('finds farming-positive stakes ONLY at 5d7 and above against Very Difficult', () => {
    // The corrected invariant, stated as measured. `resolution.md:142` used to
    // say "no stake is farming-positive" full stop, which is false.
    const positive: string[] = [];
    for (const dice of POOLS) {
      for (const band of LADDER) {
        if (REWARD_BY_BAND[band.id] === 0) continue;
        for (const stake of STAKES) {
          const net = expectedReward(dice, 0, band.id, stake) - stake;
          if (net > 0) positive.push(`${dice}d7|${band.id}|${stake}`);
        }
      }
    }
    expect(positive.sort()).toEqual([
      '5d7|very-difficult|1',
      '6d7|very-difficult|1',
    ]);
  });

  it('prices that edge, so a change to any input is visible here', () => {
    expect(expectedReward(5, 0, 'very-difficult', 1) - 1).toBeCloseTo(0.175, 2);
    expect(expectedReward(6, 0, 'very-difficult', 1) - 1).toBeCloseTo(0.576, 2);
  });

  it('keeps the edge unreachable at creation, which is what bounds it', () => {
    // 6d7 is the best a starting sheet can reach (4d7 attribute + a 2D focus),
    // and only on one skill. A 5d7+ pool needs a trained skill on a high
    // attribute, Very Difficult is 12% of cells, and DAILY_EARN_CAP closes the
    // loop: even a player who found the edge cannot bank more than five a day.
    expect(DAILY_EARN_CAP).toBe(5);
    // Everything below 5d7 is strictly negative at every stake.
    for (const dice of [2, 3, 4]) {
      for (const band of LADDER) {
        if (REWARD_BY_BAND[band.id] === 0) continue;
        for (const stake of STAKES) {
          expect(expectedReward(dice, 0, band.id, stake) - stake).toBeLessThan(
            0
          );
        }
      }
    }
  });

  it('never pays for a trivial cell, at any stake', () => {
    // The gate that stops a third of the map being a slot machine.
    for (const dice of POOLS) {
      for (const stake of STAKES) {
        expect(expectedReward(dice, 0, 'very-easy', stake)).toBe(0);
        expect(expectedReward(dice, 0, 'easy', stake)).toBe(0);
      }
    }
  });
});
