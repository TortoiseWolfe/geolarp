/**
 * Deterministic PRNG for geoLARP, seeded from a string.
 *
 * WHY NOT `@/lib/cod/audio/rng`. That one is xoshiro128** too and is perfectly
 * good, but it is untyped JavaScript with no `.d.ts`, and it seeds from a
 * number. geoLARP seeds from a *place and a date* (`the-world-is-the-board.md:31-32`),
 * which is a string, so a hash has to exist somewhere regardless. Keeping both
 * here means the game rules do not depend on the 3D toolkit at all.
 *
 * Determinism is not a nicety. The published design says an encounter "is the
 * same for everybody" because it "is derived from the place, not handed out"
 * (`:74-77`). Two devices given the same cell and the same day MUST produce the
 * same encounter, so every roll that shapes one goes through here.
 */

/** FNV-1a. Small, fast, and stable across engines — which is the requirement. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;

  constructor(seed: number | string = 0x9e3779b9) {
    this.seed(typeof seed === 'string' ? hashSeed(seed) : seed);
  }

  /** SplitMix32 spreads one 32-bit seed across the four state words. */
  seed(s: number): void {
    let z = s >>> 0;
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

  /** xoshiro128** — one unsigned 32-bit step. */
  private nextUint(): number {
    const r = Math.imul(this.s1 * 5, 1) >>> 0;
    const rot = ((r << 7) | (r >>> 25)) >>> 0;
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

  /** [0, 1) */
  float(): number {
    return this.nextUint() / 4294967296;
  }

  /** Inclusive integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.float() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}
