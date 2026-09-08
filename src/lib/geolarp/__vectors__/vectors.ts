/**
 * Golden vectors: the rules layer's output, pinned to committed literals.
 *
 * WHY THIS EXISTS. Determinism is the load-bearing published promise — "it is derived
 * from the place, not handed out... That is what makes it a shared world rather than a
 * private one" (`the-world-is-the-board.md:76-77`). Until this file, the only
 * determinism tests rolled the same seed TWICE IN ONE PROCESS and compared. That proves
 * the code is a function. It cannot detect the failure that matters: the same seed
 * producing a different answer on a different JavaScript engine.
 *
 * That failure is not hypothetical once the engine ships on a phone. React Native runs
 * Hermes, not V8. If the two disagree anywhere in this layer, every encounter on Earth
 * quietly differs between web and mobile, the shared world stops being shared, and no
 * existing test goes red.
 *
 * WHAT IS AND IS NOT AT RISK. `Math.imul`, XOR, shifts, `>>> 0`, `Math.floor`, `/` and
 * `charCodeAt` are all exactly specified by ECMA-262 and are bit-identical everywhere,
 * so `rng.ts` is safe by construction. The one implementation-approximated call in the
 * whole layer is `Math.cos`, in `cell.ts` — see `stableCos` there, which is why the
 * `cellOf` vectors below deliberately include points sitting a nanodegree from a cell
 * boundary. Those are the only inputs where a last-bit disagreement could ever show up.
 *
 * THIS FILE IS DATA AND A PURE FUNCTION, NOT A TEST. It has no `describe` or `it`, so
 * the same source runs under vitest on the web, under jest-expo on the mobile checkout,
 * and inside the app itself on a real device. jest-expo runs on Node, so a green mobile
 * unit test still proves nothing about Hermes — only running this ON THE DEVICE does.
 */
import {
  cellCentre,
  cellOf,
  flower,
  neighbour,
  offsetMetres,
  seedOf,
  type Cell,
} from '../cell';
import { encounterFor } from '../encounter';
import { generateCharacter } from '../character';
import { fromPips, roll } from '../dice';
import { successChance } from '../odds';
import { placeName } from '../place';
import { hashSeed, Rng } from '../rng';

/**
 * Seeds chosen to exercise the parts of `hashSeed` an ASCII-only list would miss.
 * The emoji matters most: `charCodeAt` walks UTF-16 code units, so a surrogate pair is
 * two iterations, and a runtime that iterated code POINTS instead would diverge here
 * and nowhere else.
 */
export const VECTOR_SEEDS: readonly string[] = [
  '',
  '0',
  'geolarp',
  '1234:-5678@2026-09-07',
  'name:0:0',
  'a\u{1F9ED}b',
  'éèê',
  'x'.repeat(4096),
];

/** Fixed date, so `seedOf` vectors do not rot at midnight. */
export const VECTOR_DATE = new Date('2026-09-07T12:00:00.000Z');

const BASE_FIXES: readonly (readonly [number, number])[] = [
  [0, 0],
  [35.0456, -85.3097], // Chattanooga — the fix the 101m centre bug was found on
  [-33.8688, 151.2093],
  [51.5074, -0.1278],
  [-0.0001, -0.0001],
  [64.1466, -21.9426],
  [-54.8019, -68.302],
  [1e-9, 1e-9],
];

/**
 * Points a nanodegree either side of a real cell boundary.
 *
 * The boundary is derived from two adjacent cell centres rather than hard-coded, so it
 * tracks `cell.ts` rather than restating it. These are the inputs where a one-ULP
 * cosine difference would flip a `Math.floor`, which is the entire reason `stableCos`
 * exists — so if that guard is ever removed, these are the vectors that notice.
 */
function boundaryFixes(): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  for (const [lat] of BASE_FIXES) {
    const here = cellOf(lat, 0);
    const a = cellCentre(here);
    const b = cellCentre({ r: here.r, q: here.q + 1 });
    const edge = (a.lon + b.lon) / 2;
    out.push([lat, edge - 1e-9], [lat, edge], [lat, edge + 1e-9]);
  }
  return out;
}

export const VECTOR_FIXES: readonly (readonly [number, number])[] = [
  ...BASE_FIXES,
  ...boundaryFixes(),
];

const DICE_CODES = [3, 6, 9, 10, 14, 21].map(fromPips);

export interface VectorTable {
  hashSeed: Record<string, number>;
  /** Eight raw 32-bit outputs per seed. `float()` is `nextUint() / 2**32` exactly. */
  rngUints: Record<string, number[]>;
  cellOf: Record<string, Cell>;
  cellCentreRoundTrip: Record<string, boolean>;
  /**
   * `grid3x3` and `offsetMetres` — THE CLASS THAT DID NOT EXIST WHEN #86 SHIPPED.
   *
   * Adjacency is public API of this layer and had no vector coverage at all, which is
   * the structural reason a defect affecting 56% of inhabited latitudes stayed green
   * through every gate. `cellOf` and `cellCentre` were pinned; the operator built on
   * top of them was not.
   *
   * `ring` is the SEVEN cells of the flower, north-up and 2-3-2, as keys — six on a
   * pointy-top hex lattice plus the centre at index 3 (#87). `northEastStep` is what
   * a player is told after one step — `east,north,bearing`. North-east rather than
   * north because a pointy-top hex has no due-north neighbour, and because it is the
   * step whose east component the half-column stagger makes non-zero, so it pins the
   * lattice as sharply as the old north step did.
   *
   * These values are NOT self-certified. `tests/unit/cell-grid.test.ts` derives the
   * same neighbours from `cellCentre` plus real metres walked, which is an independent
   * route to the same answer, and asserts they agree at four cities.
   */
  adjacency: Record<string, { ring: string[]; northEastStep: string }>;
  seedOf: Record<string, string>;
  placeName: Record<string, string>;
  encounterFor: Record<string, unknown>;
  generateCharacter: Record<string, unknown>;
  roll: Record<string, unknown>;
  /**
   * Rounded to 6 decimal places ON PURPOSE. `successChance` convolves a 16-block
   * exploding chain, summing terms around 1e-13; asserting raw float bits would fail on
   * a legitimate last-bit difference that no player could ever observe. The UI shows one
   * decimal place, so six leaves four orders of magnitude of margin.
   */
  successChance: Record<string, number>;
}

const fixKey = ([lat, lon]: readonly [number, number]): string =>
  `${lat},${lon}`;

/** Recompute the whole table from the engine as it currently stands. Pure. */
export function computeVectors(): VectorTable {
  const t: VectorTable = {
    hashSeed: {},
    rngUints: {},
    cellOf: {},
    cellCentreRoundTrip: {},
    adjacency: {},
    seedOf: {},
    placeName: {},
    encounterFor: {},
    generateCharacter: {},
    roll: {},
    successChance: {},
  };

  for (const seed of VECTOR_SEEDS) {
    const key =
      seed.length > 32 ? `${seed.slice(0, 8)}...x${seed.length}` : seed;
    t.hashSeed[key] = hashSeed(seed);

    const rng = new Rng(seed);
    t.rngUints[key] = Array.from({ length: 8 }, () => rng.float() * 4294967296);

    t.encounterFor[key] = encounterFor(seed);

    const { created: _created, ...rest } = generateCharacter(
      'Vector',
      new Rng(seed)
    );
    t.generateCharacter[key] = rest;
  }

  for (const fix of VECTOR_FIXES) {
    const key = fixKey(fix);
    const cell = cellOf(fix[0], fix[1]);
    t.cellOf[key] = cell;

    const centre = cellCentre(cell);
    const back = cellOf(centre.lat, centre.lon);
    t.cellCentreRoundTrip[key] = back.q === cell.q && back.r === cell.r;

    t.seedOf[key] = seedOf(cell, VECTOR_DATE);
    t.placeName[key] = placeName(cell);

    // NORTH-EAST, not north (#87). A pointy-top hex has no due-north neighbour;
    // the nearest thing to "one step up the map" is the north-east step, and it
    // is the one whose east component the stagger makes non-zero (+50 m at the
    // equator), so it pins the lattice as sharply as the old north step did.
    const step = offsetMetres(cell, neighbour(cell, 'north-east'));
    t.adjacency[key] = {
      ring: flower(cell).map((c) => `${c.q}:${c.r}`),
      northEastStep: `${step.east},${step.north},${step.bearing}`,
    };
  }

  for (const code of DICE_CODES) {
    for (const seed of ['a', 'b', 'c']) {
      for (const bonus of [0, 2]) {
        const key = `${code.dice}d7+${code.pips}|${seed}|${bonus}`;
        t.roll[key] = roll(code, new Rng(seed), 13, bonus);
      }
    }
    for (const target of [2, 7, 13, 18, 24, 35]) {
      t.successChance[`${code.dice}d7+${code.pips}|${target}`] =
        Math.round(successChance(code, target) * 1e6) / 1e6;
    }
  }

  return t;
}
