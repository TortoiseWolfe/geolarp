/**
 * The d7 system's arithmetic, including the falsifiers the design doc commits
 * to. These are the numbers the published post prints; if they drift, the post
 * is lying and this suite says so.
 */
import { describe, it, expect } from 'vitest';
import {
  DiceCode,
  formatCode,
  fromPips,
  normalise,
  roll,
  toPips,
} from '@/lib/geolarp/dice';
import { Rng } from '@/lib/geolarp/rng';
import {
  LADDER,
  bandOf,
  formatBand,
  formatTarget,
  rangeOf,
} from '@/lib/geolarp/ladder';

const d = (dice: number, pips = 0): DiceCode => ({ dice, pips });

describe('dice codes carry pips, D6-style', () => {
  it('treats 3 pips as one die', () => {
    expect(normalise(d(2, 3))).toEqual(d(3, 0));
    expect(normalise(d(2, 4))).toEqual(d(3, 1));
    expect(normalise(d(0, 9))).toEqual(d(3, 0));
  });

  it('never formats a rating with +3', () => {
    expect(formatCode(d(2, 3))).toBe('3d7');
    expect(formatCode(d(3, 2))).toBe('3d7+2');
    expect(formatCode(d(3, 0))).toBe('3d7');
  });

  it('round-trips through pips', () => {
    for (let p = 3; p < 40; p += 1) {
      expect(toPips(fromPips(p))).toBe(p);
    }
  });

  it('refuses a rating with no dice', () => {
    expect(() => roll(d(0, 2), new Rng(1))).toThrow(/at least one die/);
  });
});

describe('the wild die', () => {
  it('puts the wild die first and explodes only on a 7', () => {
    // Deterministic: scan seeds until we observe each case.
    let sawExplosion = false;
    let sawComplication = false;
    for (let s = 0; s < 500 && !(sawExplosion && sawComplication); s += 1) {
      const r = roll(d(3), new Rng(s));
      if (r.wild === 7) {
        sawExplosion = true;
        expect(r.faces.length).toBeGreaterThan(3); // rolled again
        expect(r.outcome).toBe('critical');
      }
      if (r.wild === 1) {
        sawComplication = true;
        expect(r.faces.length).toBe(3); // no extra die
        expect(r.outcome).toBe('complication');
      }
      expect(r.faces[0]).toBe(r.wild);
    }
    expect(sawExplosion).toBe(true);
    expect(sawComplication).toBe(true);
  });

  it('adds pips to the face total', () => {
    const r = roll(d(3, 2), new Rng(42));
    const faceSum = r.faces.reduce((a, b) => a + b, 0);
    expect(r.total).toBe(faceSum + 2);
  });

  it('reports success only when a difficulty is supplied', () => {
    expect(roll(d(3), new Rng(7)).success).toBeUndefined();
    const r = roll(d(3), new Rng(7), 13);
    expect(r.success).toBe(r.total >= 13);
  });
});

describe('the same seed gives the same roll', () => {
  it('is reproducible', () => {
    const a = roll(d(4, 1), new Rng('cell-a'));
    const b = roll(d(4, 1), new Rng('cell-a'));
    expect(a).toEqual(b);
    expect(roll(d(4, 1), new Rng('cell-b'))).not.toEqual(a);
  });
});

/**
 * Exact distribution of a plain Nd7 sum — no wild die. This is the arithmetic
 * the LADDER was rescaled with, so it is worth computing rather than sampling.
 */
function plainSumDistribution(n: number, sides = 7): number[] {
  let dist = [1];
  for (let i = 0; i < n; i += 1) {
    const out = new Array(dist.length + sides).fill(0);
    for (let sum = 0; sum < dist.length; sum += 1) {
      if (!dist[sum]) continue;
      for (let face = 1; face <= sides; face += 1) {
        out[sum + face] += dist[sum] / sides;
      }
    }
    dist = out;
  }
  return dist;
}
const atLeast = (dist: number[], target: number) =>
  dist.slice(target).reduce((a, b) => a + (b ?? 0), 0);

describe('ladder calibration (exact, plain sums)', () => {
  it("reproduces D6's benchmark: 3d6 vs Moderate (11+) is exactly 50%", () => {
    const pct = atLeast(plainSumDistribution(3, 6), 11) * 100;
    expect(pct).toBeCloseTo(50.0, 5);
  });

  it('3d7 vs the rescaled Moderate (13+) is 44.61%', () => {
    // THIS IS A CALIBRATION FIGURE, NOT A PLAY RATE. It is how the x8/7
    // rescale was checked, computed the same way as the D6 benchmark above:
    // a plain sum, no wild die. Actual play is higher — see the next block.
    const pct = atLeast(plainSumDistribution(3), 13) * 100;
    expect(pct).toBeCloseTo(44.61, 1);
  });

  it('shows why the ladder had to move at all: a d7 averages 4.0', () => {
    const dist = plainSumDistribution(3);
    const mean = dist.reduce((a, b, i) => a + b * i, 0);
    expect(mean).toBeCloseTo(12.0, 6); // 3d6 would be 10.5
  });
});

describe('published probabilities in actual play (10,000 rolls)', () => {
  const N = 10_000;
  const rng = new Rng('falsifier-suite');
  let successes = 0;
  let firstFaceSeven = 0;
  let complications = 0;
  let totalSum = 0;

  for (let i = 0; i < N; i += 1) {
    const r = roll(d(3), rng, 13);
    if (r.success) successes += 1;
    if (r.wild === 7) firstFaceSeven += 1;
    if (r.outcome === 'complication') complications += 1;
    totalSum += r.total;
  }

  it('3d7 beats Moderate (13+) 47.1% of the time once the wild die explodes', () => {
    // The exploding wild die adds 2/3 of a point to the mean, which moves the
    // success rate from the plain-sum 44.61% to 47.11%. Both numbers are real;
    // they answer different questions.
    const pct = (successes / N) * 100;
    expect(pct).toBeGreaterThan(46.1);
    expect(pct).toBeLessThan(48.1);
  });

  it("a wild 7 comes up 14.29% of the time, matching the post's :44", () => {
    const pct = (firstFaceSeven / N) * 100;
    expect(Math.abs(pct - 14.29)).toBeLessThan(1.0);
  });

  it('a natural 1 complicates 14.29% of the time, matching :49', () => {
    const pct = (complications / N) * 100;
    expect(Math.abs(pct - 14.29)).toBeLessThan(1.0);
  });

  it('averages 12.67 — the plain 12.0 plus the explosion tail', () => {
    expect(totalSum / N).toBeGreaterThan(12.2);
    expect(totalSum / N).toBeLessThan(13.2);
  });
});

describe('the difficulty ladder', () => {
  it('has no gaps between bands', () => {
    for (let i = 0; i < LADDER.length - 1; i += 1) {
      const { hi } = rangeOf(LADDER[i].id);
      expect(hi).toBe(LADDER[i + 1].floor - 1);
    }
  });

  it('states a target as a floor, because that is what success compares to', () => {
    // `roll()` resolves `success: total >= difficulty` and every caller passes
    // `bandOf(id).floor`. So a band is a RATING of the cell, not a window the
    // roll must land inside. The UI printed "Moderate (13-17)" as the target,
    // which implied 18 overshoots; it does not.
    expect(formatTarget('moderate')).toBe('13 or more');
    expect(formatTarget('heroic')).toBe('35 or more');

    const rng = new Rng('above-the-band');
    let sawAboveBand = false;
    for (let i = 0; i < 200 && !sawAboveBand; i += 1) {
      const r = roll({ dice: 6, pips: 0 }, rng, bandOf('moderate').floor);
      if (r.total > rangeOf('moderate').hi!) {
        sawAboveBand = true;
        expect(r.success).toBe(true);
      }
    }
    expect(sawAboveBand).toBe(true);
  });

  it('leaves Heroic open-ended', () => {
    expect(rangeOf('heroic').hi).toBeNull();
    expect(formatBand('heroic')).toBe('Heroic (35+)');
  });

  it('is the x8/7 rescale of D6, not D6 verbatim', () => {
    expect(LADDER.map((b) => b.floor)).toEqual([2, 7, 13, 18, 24, 35]);
    expect(formatBand('moderate')).toBe('Moderate (13-17)');
  });
});
