/**
 * The golden vectors, checked against the engine as it stands.
 *
 * This is the WEB half of a two-runtime check. It runs under vitest on Node/V8 and can
 * only catch a change to the engine itself. The mobile checkout runs the same
 * `computeVectors()` against the same `golden.json` under jest-expo — which is ALSO
 * Node/V8, so it too proves only that the vendored copy did not drift.
 *
 * Neither of them tests Hermes. Only running these vectors on a device does. That is
 * what the app's own diagnostics screen is for, and why it exists before any UI.
 *
 * MUTATION EVIDENCE, MEASURED. Changing `hashSeed`'s FNV prime from 0x01000193 to
 * 0x01000195 and re-running this file fails 94 of 279 tests:
 *
 *     34  roll              7  hashSeed            0  cellOf
 *     32  placeName         7  rngUints            0  cellCentreRoundTrip
 *                           7  encounterFor        0  seedOf
 *                           7  generateCharacter   0  successChance
 *                                                  0  adjacency
 *
 * The asymmetry is the point. Everything that consumes a seed breaks; the five purely
 * geometric or analytic classes do not touch the hash and stay green. That is evidence
 * the table is wired to the real engine rather than to a copy of itself — a table
 * regenerated from the code under test would have passed the mutation happily.
 *
 * RE-MEASURED 2026-09-07 when `adjacency` was added for #86, rather than adjusted on
 * paper. The 94 did not move and the denominator did: 246 → 279. `adjacency` landing in
 * the zero column is the check that it is pinned to geometry rather than to the hash —
 * had it appeared among the failures, it would have been reading a seed it has no
 * business reading.
 *
 * Note `hashSeed` fails 7 of its 8, not 8. The empty-string seed never enters the
 * multiply loop, so its hash is the untouched FNV offset basis and no prime can move it.
 * If a future mutation makes that one fail too, the loop guard changed, not the prime.
 */
import { describe, expect, it } from 'vitest';
import golden from '@/lib/geolarp/__vectors__/golden.json';
import {
  computeVectors,
  VECTOR_FIXES,
  VECTOR_SEEDS,
} from '@/lib/geolarp/__vectors__/vectors';
import { hashSeed } from '@/lib/geolarp/rng';

const actual = computeVectors() as unknown as Record<
  string,
  Record<string, unknown>
>;
const expected = golden as unknown as Record<string, Record<string, unknown>>;

describe('golden vectors', () => {
  it('the table is not empty, and covers every class', () => {
    // A fixture that silently emptied would otherwise pass every test below.
    const classes = Object.keys(expected);
    expect(classes).toHaveLength(11);
    const total = classes.reduce(
      (n, c) => n + Object.keys(expected[c]).length,
      0
    );
    expect(total).toBeGreaterThanOrEqual(264);
    expect(VECTOR_SEEDS.length).toBeGreaterThanOrEqual(8);
    expect(VECTOR_FIXES.length).toBeGreaterThanOrEqual(32);
  });

  for (const cls of Object.keys(golden as object)) {
    describe(cls, () => {
      const keys = Object.keys(expected[cls]);

      it('covers exactly the committed keys — no vector silently dropped', () => {
        expect(Object.keys(actual[cls]).sort()).toEqual(keys.sort());
      });

      it.each(keys)('%s', (key) => {
        expect(actual[cls][key]).toEqual(expected[cls][key]);
      });
    });
  }
});

describe('the vectors can fail', () => {
  /**
   * `rng.ts` as it stands, except for the rotation constant in `nextUint`.
   *
   * A mutation has to actually change the stream to be worth anything as a control, and
   * the obvious candidate does NOT. See the `Math.imul` test below: rewriting line 54
   * from the shipped `Math.imul(this.s1 * 5, 1)` to the idiomatic `Math.imul(this.s1, 5)`
   * produces a byte-identical stream, so it would have been a control that never fires.
   * Rotating by 8 instead of 7 is a real change to a real constant.
   */
  class MutatedRng {
    private s0 = 0;
    private s1 = 0;
    private s2 = 0;
    private s3 = 0;

    constructor(seed: string) {
      let z = hashSeed(seed) >>> 0;
      const next = (): number => {
        z = (z + 0x9e3779b9) >>> 0;
        let x = z;
        x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
        x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
        return (x ^ (x >>> 15)) >>> 0;
      };
      this.s0 = next();
      this.s1 = next();
      this.s2 = next();
      this.s3 = next();
    }

    nextUint(): number {
      const r = Math.imul(this.s1 * 5, 1) >>> 0;
      const rot = ((r << 8) | (r >>> 24)) >>> 0; // <- 7 in the real one
      const result = Math.imul(rot, 9) >>> 0;
      const t = (this.s1 << 9) >>> 0;
      this.s2 ^= this.s0;
      this.s3 ^= this.s1;
      this.s1 ^= this.s2;
      this.s0 ^= this.s3;
      this.s2 ^= t;
      this.s3 = ((this.s3 << 11) | (this.s3 >>> 21)) >>> 0;
      return result;
    }
  }

  it('a one-constant change to the RNG produces a different stream', () => {
    let differing = 0;
    for (const seed of VECTOR_SEEDS) {
      const key =
        seed.length > 32 ? `${seed.slice(0, 8)}...x${seed.length}` : seed;
      const rng = new MutatedRng(seed);
      const mutated = Array.from({ length: 8 }, () => rng.nextUint());
      if (JSON.stringify(mutated) !== JSON.stringify(expected.rngUints[key])) {
        differing += 1;
      }
    }
    // Every seed, not merely one: a control that fired on a single input would leave
    // open the possibility that the table barely discriminates.
    expect(differing).toBe(VECTOR_SEEDS.length);
  });

  /**
   * A claim about `rng.ts:54` that turned out to be false, pinned so it stays false.
   *
   * The shipped line is `Math.imul(this.s1 * 5, 1)`, where every reference
   * implementation of xoshiro128** writes `Math.imul(this.s1, 5)`. That looks like a
   * stream this codebase alone produces, and it was written up that way. It is not.
   * `s1` is always a uint32, so `s1 * 5 < 2**35` is exactly representable as a double,
   * and `Math.imul(x, 1)` truncates mod 2**32 exactly as `Math.imul(a, 5)` does. The two
   * forms are equal for EVERY uint32.
   *
   * Which means line 54 is safe to tidy, this engine IS reference-comparable, and nobody
   * needs to spend another hour on it. Both forms use only exactly-specified operations,
   * so both are engine-independent — the real portability risk was never here, it was
   * `Math.cos` in cell.ts, which is why `stableCos` exists.
   */
  it('Math.imul(s1 * 5, 1) equals Math.imul(s1, 5) for every uint32', () => {
    const probes = [
      0, 1, 5, 0x7fffffff, 0x80000000, 0xffffffff, 0x9e3779b9, 858993459,
    ];
    for (const v of probes) {
      expect(Math.imul(v * 5, 1) >>> 0).toBe(Math.imul(v, 5) >>> 0);
    }
    // and across the range, not only at hand-picked points
    let checked = 0;
    for (let v = 0; v < 0xffffffff; v += 7_919_311) {
      expect(Math.imul(v * 5, 1) >>> 0).toBe(Math.imul(v, 5) >>> 0);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('the comparison itself reports a mismatch rather than passing', () => {
    const tampered = { ...expected.hashSeed, geolarp: 0 };
    expect(() => expect(actual.hashSeed).toEqual(tampered)).toThrow();
  });
});
