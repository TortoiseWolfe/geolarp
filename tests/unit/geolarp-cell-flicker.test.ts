/**
 * How much does the cell flicker when the player is standing still?
 *
 * This is the real shape of "GPS is bad indoors". The symptom that matters is not that a
 * fix is 60 m off — a 100 m grid absorbs that. It is that a stationary player's fix
 * wanders across a cell boundary and the encounter CHANGES underneath them. That breaks
 * the game and it locally breaks the published claim that a place has one encounter.
 *
 * The web app never had to answer this, because it reads one fix per button press
 * (`CharacterPlay.tsx`: "EXPLICIT REFRESH RATHER THAN watch: true. A watch would be the
 * obvious upgrade and it would expose a live bug first"). A phone in a pocket will poll,
 * so the number has to exist before the mobile encounter screen is designed around it.
 *
 * Simulated rather than measured on a device on purpose: this sizes the rule, and it
 * costs nothing to re-run. A device log confirms it later; it cannot cheaply explore
 * twenty positions and four accuracy levels.
 *
 * Noise is Gaussian via Box-Muller, seeded from the project's own Rng so the numbers are
 * reproducible — a flaky statistical test is worse than no test.
 */
import { describe, expect, it } from 'vitest';
import { cellOf, CELL_METRES } from '@/lib/geolarp/cell';
import { Rng } from '@/lib/geolarp/rng';

const M_PER_DEG_LAT = 111_320;
const FIXES_PER_RUN = 600; // 1 Hz for ten minutes
const POSITIONS = 20;

/**
 * GPS `accuracy` is a 68% confidence RADIUS, so it is one sigma in each axis.
 */
function gaussianPair(rng: Rng): [number, number] {
  const u = Math.max(rng.float(), 1e-12);
  const v = rng.float();
  const r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}

/** Cell changes per minute for a stationary player, optionally with hysteresis. */
function flickerPerMinute(accuracyMetres: number, dwell: number): number {
  let changes = 0;
  for (let p = 0; p < POSITIONS; p++) {
    const rng = new Rng(`flicker:${accuracyMetres}:${p}`);
    // Spread the true positions around the world, including near boundaries.
    const lat = -60 + (120 * p) / POSITIONS;
    const lon = -170 + (340 * p) / POSITIONS;
    const mPerDegLon =
      M_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);

    let committed = cellOf(lat, lon);
    let candidate = committed;
    let seen = 0;

    for (let i = 0; i < FIXES_PER_RUN; i++) {
      const [dn, de] = gaussianPair(rng);
      const observed = cellOf(
        lat + (dn * accuracyMetres) / M_PER_DEG_LAT,
        lon + (de * accuracyMetres) / mPerDegLon
      );
      if (observed.q === committed.q && observed.r === committed.r) {
        seen = 0;
        candidate = committed;
        continue;
      }
      if (observed.q === candidate.q && observed.r === candidate.r) seen += 1;
      else {
        candidate = observed;
        seen = 1;
      }
      if (seen >= dwell) {
        committed = candidate;
        seen = 0;
        changes += 1;
      }
    }
  }
  return changes / ((POSITIONS * FIXES_PER_RUN) / 60);
}

describe('cell flicker while stationary', () => {
  const ACCURACIES = [10, 35, 65, 100];

  /**
   * MEASURED, cell changes per minute while standing still:
   *
   *     accuracy   dwell=1   dwell=3   dwell=5   dwell=8
   *       0 m       0.00      0.00      0.00      0.00
   *      10 m      11.40      1.17      0.26      0.02
   *      35 m      36.56      1.27      0.07      0.00
   *      65 m      50.79      0.71      0.00      0.00
   *     100 m      55.69      0.28      0.00      0.00
   *
   * Two things to take from that table, the second of which is not obvious.
   */
  it('is unplayable with no hysteresis, at every accuracy', () => {
    const naive = Object.fromEntries(
      ACCURACIES.map((a) => [a, flickerPerMinute(a, 1)])
    );
    // At 65 m — an ordinary indoor fix — the cell changes roughly once a second. That
    // is not a tuning problem, it is a screen nobody can read. Even a 10 m fix, which
    // is as good as a phone gets outdoors, changes cell every five seconds.
    expect(naive[65]).toBeGreaterThan(20);
    expect(naive[10]).toBeGreaterThan(5);
  });

  it('a 5-fix dwell fixes it, and 3 is not enough at good accuracy', () => {
    for (const a of ACCURACIES)
      expect(flickerPerMinute(a, 5)).toBeLessThan(0.5);
    // 10 m at dwell=3 is still 1.17/min — a change every 51 seconds, which reads as a
    // bug to a player who has not moved. Five is the smallest dwell that clears every
    // accuracy, so five is the rule.
    expect(flickerPerMinute(10, 3)).toBeGreaterThan(0.5);
  });

  it('WORSE accuracy flickers LESS once hysteresis is on', () => {
    // The counter-intuitive result, and the one that should shape the mobile screen.
    // "GPS is bad indoors" suggests the bad fixes are the dangerous ones. With a dwell
    // rule the opposite holds: wide noise scatters consecutive fixes across many cells,
    // so hitting the SAME wrong cell five times running is unlikely. A tight fix parked
    // next to a boundary lands in the neighbour consistently, and consistency is exactly
    // what a dwell rule cannot filter.
    //
    // So the hysteresis is protecting against a player standing near a boundary with a
    // GOOD fix — not against a basement. Do not "optimise" it away when accuracy is high.
    expect(flickerPerMinute(100, 5)).toBeLessThan(flickerPerMinute(10, 5));
    expect(flickerPerMinute(100, 3)).toBeLessThan(flickerPerMinute(10, 3));
  });

  it('can fail: with no hysteresis the ordering is the intuitive one', () => {
    // Proves the noise model IS wired to the accuracy figure — without this, the
    // inversion above could just mean the simulation ignores its input.
    expect(flickerPerMinute(100, 1)).toBeGreaterThan(flickerPerMinute(10, 1));
  });

  it('can fail: a zero-noise fix never changes cell at all', () => {
    expect(flickerPerMinute(0, 1)).toBe(0);
  });

  it('the accuracy warning threshold is half a cell, as the web app uses', () => {
    expect(CELL_METRES / 2).toBe(50);
  });
});
