import { describe, it, expect } from 'vitest';
import {
  MAX_POINTS_PER_ROLL,
  PURCHASE_COST,
  buy,
  pointsSpent,
  purchaseRefusal,
  purchaseSeed,
  replayPurchases,
  roll,
  type DiceCode,
  type RollResult,
} from '@/lib/geolarp/dice';
import {
  dieRescueChance,
  rerollRescueChance,
  successChance,
  successChanceWithPurchase,
} from '@/lib/geolarp/odds';
import { Rng } from '@/lib/geolarp/rng';

/**
 * Character Points buy a second chance AFTER the roll (Jonathan's ruling, 4 Nov
 * 2026, on the council's result): an extra die or a reroll, one point each, at
 * most two points on any one roll. These tests pin the rules, the prices and
 * the odds the ruling was made on.
 */

const THREE_D7: DiceCode = { dice: 3, pips: 0 };
const MODERATE = 13;
const DIFFICULT = 18;

/** The first seeded roll that misses `target`, so a purchase has something to fix. */
function aMiss(
  code: DiceCode,
  target: number,
  skip = 0
): { seed: string; base: RollResult } {
  let seen = 0;
  for (let i = 0; i < 10_000; i += 1) {
    const seed = `miss-${i}`;
    const base = roll(code, new Rng(`${seed}|0`), target);
    if (base.success === false) {
      if (seen === skip) return { seed, base };
      seen += 1;
    }
  }
  throw new Error('no miss found');
}

/** The first seeded roll that beats `target`. */
function aWin(code: DiceCode, target: number): RollResult {
  for (let i = 0; i < 10_000; i += 1) {
    const base = roll(code, new Rng(`win-${i}|0`), target);
    if (base.success === true) return base;
  }
  throw new Error('no win found');
}

describe('what a Character Point costs', () => {
  it('is one point for an extra die and one for a reroll, never double', () => {
    expect(PURCHASE_COST).toBe(1);
    const { seed, base } = aMiss(THREE_D7, DIFFICULT);
    const die = buy(
      THREE_D7,
      base,
      'die',
      new Rng(purchaseSeed(seed, 'die', 1)),
      DIFFICULT
    );
    const reroll = buy(
      THREE_D7,
      base,
      'reroll',
      new Rng(purchaseSeed(seed, 'reroll', 1)),
      DIFFICULT
    );
    expect(pointsSpent(base)).toBe(0);
    expect(pointsSpent(die)).toBe(1);
    expect(pointsSpent(reroll)).toBe(1);
  });

  it('caps one roll at two points, across both options together', () => {
    expect(MAX_POINTS_PER_ROLL).toBe(2);
  });
});

describe('buying an extra die after the roll', () => {
  it('adds one ORDINARY d7 to the dice already on the table', () => {
    const { seed, base } = aMiss(THREE_D7, DIFFICULT);
    const bought = buy(
      THREE_D7,
      base,
      'die',
      new Rng(purchaseSeed(seed, 'die', 1)),
      DIFFICULT
    );
    const face = bought.faces[bought.faces.length - 1];
    expect(bought.faces.slice(0, -1)).toEqual(base.faces);
    expect(face).toBeGreaterThanOrEqual(1);
    expect(face).toBeLessThanOrEqual(7);
    expect(bought.total).toBe(base.total + face);
    expect(bought.bonusDice).toBe(1);
    expect(bought.purchases).toEqual(['die']);
    // The wild die is the one already rolled; a bought die never explodes.
    expect(bought.wild).toBe(base.wild);
    expect(bought.outcome).toBe(base.outcome);
    expect(bought.success).toBe(bought.total >= DIFFICULT);
  });

  it('keeps the dice the player has already seen', () => {
    const { seed, base } = aMiss(THREE_D7, MODERATE);
    const bought = buy(
      THREE_D7,
      base,
      'die',
      new Rng(purchaseSeed(seed, 'die', 1)),
      MODERATE
    );
    expect(bought.faces.slice(0, base.faces.length)).toEqual(base.faces);
  });
});

describe('buying a reroll after the roll', () => {
  it('rolls the whole pool again, fresh, and keeps nothing of the miss', () => {
    const { seed, base } = aMiss(THREE_D7, DIFFICULT);
    const rng = purchaseSeed(seed, 'reroll', 1);
    const bought = buy(THREE_D7, base, 'reroll', new Rng(rng), DIFFICULT);
    const fresh = roll(THREE_D7, new Rng(rng), DIFFICULT, 0);
    expect(bought.faces).toEqual(fresh.faces);
    expect(bought.total).toBe(fresh.total);
    expect(bought.success).toBe(fresh.success);
    expect(bought.purchases).toEqual(['reroll']);
  });

  it('keeps dice bought earlier: die then reroll rolls a four-dice pool', () => {
    const { seed, base } = aMiss(THREE_D7, DIFFICULT);
    const withDie = buy(
      THREE_D7,
      base,
      'die',
      new Rng(purchaseSeed(seed, 'die', 1)),
      DIFFICULT
    );
    if (withDie.success) return; // nothing left to buy; covered below
    const again = buy(
      THREE_D7,
      withDie,
      'reroll',
      new Rng(purchaseSeed(seed, 'reroll', 2)),
      DIFFICULT
    );
    expect(again.bonusDice).toBe(1);
    expect(again.faces.length).toBeGreaterThanOrEqual(4);
    expect(again.purchases).toEqual(['die', 'reroll']);
    expect(pointsSpent(again)).toBe(2);
  });
});

describe('when a purchase is allowed', () => {
  it('refuses any purchase before the roll', () => {
    expect(purchaseRefusal(null, 5)).toBe('no-roll');
  });

  it('refuses a purchase on a roll that already beat the cell', () => {
    expect(purchaseRefusal(aWin(THREE_D7, MODERATE), 5)).toBe('won');
  });

  it('refuses when the player has no points', () => {
    const { base } = aMiss(THREE_D7, DIFFICULT);
    expect(purchaseRefusal(base, 0)).toBe('broke');
  });

  it('allows a miss with points in hand', () => {
    const { base } = aMiss(THREE_D7, DIFFICULT);
    expect(purchaseRefusal(base, 5)).toBeNull();
  });

  it('refuses a third point on one roll, however many the player holds', () => {
    // Two losing purchases in a row, found by walking seeds.
    for (let skip = 0; skip < 200; skip += 1) {
      const { seed, base } = aMiss(THREE_D7, 35, skip); // Heroic: still missing
      const one = buy(
        THREE_D7,
        base,
        'reroll',
        new Rng(purchaseSeed(seed, 'reroll', 1)),
        35
      );
      if (one.success) continue;
      expect(purchaseRefusal(one, 5)).toBeNull();
      const two = buy(
        THREE_D7,
        one,
        'die',
        new Rng(purchaseSeed(seed, 'die', 2)),
        35
      );
      expect(pointsSpent(two)).toBe(2);
      if (two.success) continue;
      expect(purchaseRefusal(two, 5)).toBe('cap');
      expect(() =>
        buy(THREE_D7, two, 'die', new Rng(purchaseSeed(seed, 'die', 3)), 35)
      ).toThrow(/at most 2/);
      return;
    }
    throw new Error('no double miss found');
  });

  it('throws if asked to buy against a win, rather than quietly re-rolling it', () => {
    const base = aWin(THREE_D7, MODERATE);
    expect(() => buy(THREE_D7, base, 'reroll', new Rng('x'), MODERATE)).toThrow(
      /already/
    );
  });
});

describe('a cell does not hand out fresh dice for a point', () => {
  it('replays the same purchases to the same roll, from the cell seed alone', () => {
    const { seed, base } = aMiss(THREE_D7, DIFFICULT);
    const a = replayPurchases(THREE_D7, base, seed, ['die'], DIFFICULT);
    const b = replayPurchases(THREE_D7, base, seed, ['die'], DIFFICULT);
    expect(a).toEqual(b);
    expect(a.purchases).toEqual(['die']);
  });

  it('gives a die and a reroll different dice, so the choice is a real bet', () => {
    const { seed, base } = aMiss(THREE_D7, DIFFICULT);
    const die = replayPurchases(THREE_D7, base, seed, ['die'], DIFFICULT);
    const reroll = replayPurchases(THREE_D7, base, seed, ['reroll'], DIFFICULT);
    expect(die.faces).not.toEqual(reroll.faces);
  });
});

/**
 * THE ODDS THE RULING WAS MADE ON. The council's table (success chance %, with
 * nothing bought / buy a die if the roll misses / buy a reroll if it misses):
 *
 *   3d7 Moderate(13)   47.1  80.6  72.0
 *   3d7 Difficult(18)  12.4  39.5  23.3
 *   4d7 Moderate(13)   80.6  95.3  96.2
 *   5d7 Difficult(18)  71.7  90.7  92.0
 *
 * `successChance` is exact. Policy "buy a die when you miss" succeeds exactly
 * when the pool with one more die does (the extra die only adds), and policy
 * "buy a reroll when you miss" is 1 - (1 - p)^2.
 */
describe("the council's odds table, from the exact distribution", () => {
  const rows: Array<[number, number, number, number, number]> = [
    [3, MODERATE, 47.1, 80.6, 72.0],
    [3, DIFFICULT, 12.4, 39.5, 23.3],
    [4, MODERATE, 80.6, 95.3, 96.2],
    [5, DIFFICULT, 71.7, 90.7, 92.0],
  ];
  it.each(rows)(
    '%id7 against %i: %f / %f / %f',
    (dice, target, base, die, reroll) => {
      const code = { dice, pips: 0 };
      expect(successChance(code, target) * 100).toBeCloseTo(base, 1);
      expect(successChanceWithPurchase(code, target, 'die') * 100).toBeCloseTo(
        die,
        1
      );
      expect(
        successChanceWithPurchase(code, target, 'reroll') * 100
      ).toBeCloseTo(reroll, 1);
    }
  );

  it('a reroll rescues a miss at exactly the pool’s own chance', () => {
    expect(rerollRescueChance(THREE_D7, DIFFICULT)).toBe(
      successChance(THREE_D7, DIFFICULT)
    );
  });

  it('an extra die rescues a miss by exactly the face needed, 1-in-7 steps', () => {
    // Needing 1 or less: any face. Needing 7: one face in seven. Needing 8+:
    // an ordinary d7 cannot do it.
    expect(dieRescueChance(17, 18)).toBe(1);
    expect(dieRescueChance(14, 18)).toBeCloseTo(4 / 7, 12);
    expect(dieRescueChance(11, 18)).toBeCloseTo(1 / 7, 12);
    expect(dieRescueChance(10, 18)).toBe(0);
  });
});

describe('the odds, checked against the real roll() and buy()', () => {
  /**
   * 120,000 seeded rolls per policy, fixed seed prefix so a failure replays.
   * The tolerance is three standard errors at p = 0.5 (about 0.0043).
   */
  const N = 120_000;
  function policyRate(
    code: DiceCode,
    target: number,
    kind: 'die' | 'reroll' | null
  ): number {
    let wins = 0;
    for (let i = 0; i < N; i += 1) {
      const seed = `sim-${i}`;
      let r = roll(code, new Rng(`${seed}|0`), target);
      if (kind && r.success === false) {
        r = buy(code, r, kind, new Rng(purchaseSeed(seed, kind, 1)), target);
      }
      if (r.success) wins += 1;
    }
    return wins / N;
  }

  it.each([
    [3, MODERATE],
    [3, DIFFICULT],
    [4, MODERATE],
  ])(
    '%id7 against %i matches the exact figures',
    (dice, target) => {
      const code = { dice, pips: 0 };
      expect(policyRate(code, target, null)).toBeCloseTo(
        successChance(code, target),
        2
      );
      expect(policyRate(code, target, 'die')).toBeCloseTo(
        successChanceWithPurchase(code, target, 'die'),
        2
      );
      expect(policyRate(code, target, 'reroll')).toBeCloseTo(
        successChanceWithPurchase(code, target, 'reroll'),
        2
      );
    },
    60_000
  );
});
