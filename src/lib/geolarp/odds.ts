/**
 * What a roll is actually worth, before you pay for it.
 *
 * THE DEFECT THIS EXISTS FOR. A playtester's first session landed on a Heroic
 * cell — floor 35, the 3%-weight band, unreachable by a starting 3d7 sheet —
 * spent all five Character Points against it, and lost. Every question they
 * asked afterwards followed from that.
 *
 * THE OBVIOUS FIX IS FORBIDDEN. Rerolling the cell for a new character would
 * break a published promise: "everyone standing there today meets the same
 * thing" (`the-world-is-the-board.md:76-77`). The world does not bend around
 * who is looking at it, so the honest fix is not to change the cell — it is to
 * stop the player spending into it blind.
 *
 * EXACT, NOT SIMULATED. The distribution is small enough to compute, so this
 * does, and `odds.test.ts` cross-checks every published figure against 200k
 * actual `roll()` calls. Two independent derivations that agree are worth more
 * than either alone — and a Monte Carlo estimate shown to four significant
 * figures would be a precision the method does not have.
 */
import { DiceCode, normalise } from './dice';

/** Faces on the die. */
const FACES = 7;

/**
 * How far to follow the exploding chain.
 *
 * Each additional block costs a factor of 7 in probability, so sixteen blocks
 * leaves under 1e-13 unaccounted — far below anything a percentage rounded for
 * a player could show, and below the tolerance the simulation cross-check uses.
 */
const EXPLOSION_BLOCKS = 16;

/**
 * The wild die's distribution.
 *
 * It rolls 1..7; on a 7 it explodes and adds another roll, repeating. So its
 * value is `7a + b` for `b` in 1..6, with probability `(1/7)^(a+1)`.
 *
 * NOTE IT CAN NEVER SHOW EXACTLY 7, 14 OR 21 — the chain only stops on a
 * non-seven, so those totals are unreachable. That is a real property of the
 * rule rather than an artefact, and the test asserts it, because a
 * "simplified" implementation that lets the wild die land on 7 would be
 * subtly wrong everywhere and look right.
 */
function wildDistribution(): number[] {
  const max = FACES * EXPLOSION_BLOCKS + FACES;
  const dist = new Array<number>(max + 1).fill(0);
  for (let a = 0; a < EXPLOSION_BLOCKS; a += 1) {
    const p = Math.pow(1 / FACES, a + 1);
    for (let b = 1; b <= FACES - 1; b += 1) dist[FACES * a + b] += p;
  }
  return dist;
}

/** Convolve a distribution with one ordinary d7. */
function addOrdinaryDie(dist: number[]): number[] {
  const out = new Array<number>(dist.length + FACES).fill(0);
  for (let v = 0; v < dist.length; v += 1) {
    const p = dist[v];
    if (p === 0) continue;
    for (let f = 1; f <= FACES; f += 1) out[v + f] += p / FACES;
  }
  return out;
}

const cache = new Map<string, number>();

/**
 * The probability that this pool meets or beats `target`.
 *
 * `target` is a band FLOOR, matching `roll()`, which succeeds on
 * `total >= difficulty`. Returns a number in [0, 1].
 */
export function successChance(
  code: DiceCode,
  target: number,
  bonusDice = 0
): number {
  const n = normalise(code);
  if (n.dice < 1) {
    throw new Error('a rating needs at least one die');
  }
  const key = `${n.dice}d7+${n.pips}|${target}|${bonusDice}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let dist = wildDistribution();
  // The wild die is one of the pool, so the rest are ordinary.
  const ordinary = n.dice + bonusDice - 1;
  for (let i = 0; i < ordinary; i += 1) dist = addOrdinaryDie(dist);

  let p = 0;
  for (let v = 0; v < dist.length; v += 1) {
    if (v + n.pips >= target) p += dist[v];
  }
  const clamped = Math.min(1, Math.max(0, p));
  cache.set(key, clamped);
  return clamped;
}

/**
 * The chance, phrased for someone deciding whether to spend.
 *
 * Deliberately COARSE. A player choosing whether to burn a Character Point
 * needs to know "basically never" from "worth a go", and showing 2.7% implies
 * the game is offering a precision the decision does not need. The two ends
 * are named rather than numbered because that is where a number reads worst:
 * "3%" invites one more try, "almost never" does not.
 */
export function describeChance(p: number): string {
  if (p >= 0.995) return 'almost certain';
  if (p < 0.01) return 'almost never';
  return `about ${Math.round(p * 100)}%`;
}
