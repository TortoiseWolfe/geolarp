import { describe, it, expect } from 'vitest';
import { successChance, describeChance } from '@/lib/geolarp/odds';
import { roll } from '@/lib/geolarp/dice';
import { Rng } from '@/lib/geolarp/rng';
import { bandOf } from '@/lib/geolarp/ladder';

/** Empirical rate from the real roller, which is the thing being described. */
function simulate(
  code: { dice: number; pips: number },
  target: number,
  bonusDice: number,
  trials: number,
  seed: string
): number {
  const rng = new Rng(seed);
  let wins = 0;
  for (let i = 0; i < trials; i += 1) {
    if (roll(code, rng, target, bonusDice).success) wins += 1;
  }
  return wins / trials;
}

describe('successChance', () => {
  it('AGREES WITH THE ROLLER IT DESCRIBES', () => {
    // The load-bearing test. The exact distribution and 200k actual `roll()`
    // calls are two independent derivations of the same number; either alone
    // could be confidently wrong, and a disagreement means the odds shown to a
    // player do not describe the dice they are about to throw.
    const cases = [
      { code: { dice: 3, pips: 0 }, target: 13, bonus: 0 },
      { code: { dice: 3, pips: 1 }, target: 18, bonus: 0 },
      { code: { dice: 3, pips: 1 }, target: 18, bonus: 5 },
      { code: { dice: 4, pips: 2 }, target: 24, bonus: 2 },
      { code: { dice: 5, pips: 0 }, target: 35, bonus: 5 },
      { code: { dice: 2, pips: 0 }, target: 7, bonus: 0 },
    ];
    for (const c of cases) {
      const exact = successChance(c.code, c.target, c.bonus);
      const empirical = simulate(
        c.code,
        c.target,
        c.bonus,
        200_000,
        `sim|${c.target}|${c.bonus}`
      );
      expect(
        Math.abs(exact - empirical),
        `${c.code.dice}d7+${c.code.pips} +${c.bonus} vs ${c.target}: exact ${exact.toFixed(4)} vs simulated ${empirical.toFixed(4)}`
      ).toBeLessThan(0.006);
    }
  });

  it('reproduces the two published calibration numbers', () => {
    // `resolution.md` states both, and they answer different questions:
    // plain 3d7 vs Moderate is how the ladder was calibrated; the same roll
    // WITH the exploding wild die is what a player experiences. This library
    // models the exploding die, so it must produce the second.
    const p = successChance({ dice: 3, pips: 0 }, bandOf('moderate').floor);
    expect(p).toBeGreaterThan(0.46);
    expect(p).toBeLessThan(0.48);
  });

  it('prices the session this whole change exists for', () => {
    // THIS CORRECTED THE PREMISE IT WAS WRITTEN TO CONFIRM.
    //
    // The plan, and the ticket, both said a Heroic cell was "unreachable by a
    // 3d7 starting sheet". At zero stake that is true — one in a thousand. At
    // full stake it is 43%, and the playtester who "used all my rerolls" on
    // one was not hitting a wall: they were taking a coin-flip nobody had
    // shown them, and losing it.
    //
    // So the economy is not the defect. The silence was. Spending five points
    // really does turn 0.1% into 43%, which is the sink working exactly as
    // designed — and a player who could see that would have been making a
    // decision instead of a wish.
    const starting = { dice: 3, pips: 1 };
    const heroic = bandOf('heroic').floor;
    expect(successChance(starting, heroic, 0)).toBeLessThan(0.005);
    expect(successChance(starting, heroic, 5)).toBeGreaterThan(0.4);
    expect(successChance(starting, heroic, 5)).toBeLessThan(0.46);
    expect(describeChance(successChance(starting, heroic, 0))).toBe(
      'almost never'
    );
    expect(describeChance(successChance(starting, heroic, 5))).toBe(
      'about 43%'
    );
  });

  it('prices the whole ladder for a starting sheet, so the table cannot drift', () => {
    // Pinned because these six numbers are the argument that the ladder is
    // tuned: every band is winnable, each costs more than the last, and only
    // Heroic needs the entire purse. A change to the dice, the ladder or the
    // wild die that moved these would be a change to the game's difficulty
    // curve, and it should not be possible to make it silently.
    const starting = { dice: 3, pips: 1 };
    const pct = (b: Parameters<typeof bandOf>[0], bonus: number) =>
      Math.round(successChance(starting, bandOf(b).floor, bonus) * 1000) / 10;
    expect(pct('easy', 0)).toBeCloseTo(97.1, 1);
    expect(pct('moderate', 0)).toBeCloseTo(57.0, 1);
    expect(pct('difficult', 0)).toBeCloseTo(16.7, 1);
    expect(pct('very-difficult', 0)).toBeCloseTo(3.2, 1);
    expect(pct('heroic', 0)).toBeCloseTo(0.1, 1);
    expect(pct('heroic', 5)).toBeCloseTo(43.0, 1);
  });

  it('rises with every die bought, so the spend control means something', () => {
    const code = { dice: 3, pips: 1 };
    const target = bandOf('difficult').floor;
    let prev = -1;
    for (let bonus = 0; bonus <= 5; bonus += 1) {
      const p = successChance(code, target, bonus);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it('is a probability, never outside [0, 1]', () => {
    expect(successChance({ dice: 3, pips: 0 }, 2)).toBeLessThanOrEqual(1);
    expect(successChance({ dice: 1, pips: 0 }, 999)).toBeGreaterThanOrEqual(0);
    // A floor of 2 is the bottom of the ladder and a single die always clears
    // it, so this is a genuine certainty rather than a rounding artefact.
    expect(successChance({ dice: 3, pips: 0 }, 2)).toBeCloseTo(1, 12);
  });

  it('models a wild die that can never show exactly seven', () => {
    // The chain only stops on a NON-seven, so 7, 14 and 21 are unreachable
    // wild values. An implementation that let it land on 7 would be subtly
    // wrong everywhere and look completely right.
    const single = { dice: 1, pips: 0 };
    const atLeast7 = successChance(single, 7);
    const atLeast8 = successChance(single, 8);
    expect(atLeast7).toBeCloseTo(atLeast8, 12);
    expect(successChance(single, 6)).toBeGreaterThan(atLeast7);
  });
});

describe('describeChance', () => {
  it('names the two ends rather than numbering them', () => {
    // "3%" invites one more try. "almost never" does not, and the whole point
    // is to inform a spending decision rather than to decorate it.
    expect(describeChance(0.004)).toBe('almost never');
    expect(describeChance(0.999)).toBe('almost certain');
    expect(describeChance(0.5)).toBe('about 50%');
    expect(describeChance(0.128)).toBe('about 13%');
  });
});
