import { describe, it, expect } from 'vitest';
import {
  Cell,
  CELL_METRES,
  grid3x3,
  offsetMetres,
  cellOf,
  cellCentre,
} from '@/lib/geolarp/cell';

const CENTRE: Cell = { x: 10, y: 20 };

describe('grid3x3', () => {
  it('is nine cells with the given one in the middle', () => {
    const g = grid3x3(CENTRE);
    expect(g).toHaveLength(9);
    expect(g[4]).toEqual(CENTRE);
  });

  it('is NORTH-UP, so a renderer can lay it out row-major', () => {
    // The bug this prevents draws the world upside down, and looks fine until
    // someone walks north and the highlight moves the wrong way.
    const g = grid3x3(CENTRE);
    expect(g[0]).toEqual({ x: 9, y: 21 }); // north-west
    expect(g[2]).toEqual({ x: 11, y: 21 }); // north-east
    expect(g[6]).toEqual({ x: 9, y: 19 }); // south-west
    expect(g[8]).toEqual({ x: 11, y: 19 }); // south-east
    // Latitude index grows northward, so row 0 is the HIGHEST y.
    expect(g[0].y).toBeGreaterThan(g[6].y);
  });

  it('has no duplicates', () => {
    const keys = new Set(grid3x3(CENTRE).map((c) => `${c.x}:${c.y}`));
    expect(keys.size).toBe(9);
  });
});

describe('offsetMetres', () => {
  it('reports nothing for the cell you are standing in', () => {
    expect(offsetMetres(CENTRE, CENTRE)).toEqual({
      east: 0,
      north: 0,
      metres: 0,
      bearing: null,
    });
  });

  it('counts cells in whole metres, in both axes', () => {
    const to = { x: CENTRE.x + 4, y: CENTRE.y + 2 };
    const o = offsetMetres(CENTRE, to);
    expect(o.east).toBe(4 * CELL_METRES);
    expect(o.north).toBe(2 * CELL_METRES);
    expect(o.metres).toBe(Math.round(Math.hypot(400, 200)));
    expect(o.bearing).toBe('north-east');
  });

  it('signs west and south negative', () => {
    const o = offsetMetres(CENTRE, { x: CENTRE.x - 3, y: CENTRE.y - 3 });
    expect(o.east).toBe(-300);
    expect(o.north).toBe(-300);
    expect(o.bearing).toBe('south-west');
  });

  it('rounds to the NEAREST octant, not to a quadrant', () => {
    // 300 west and 100 south is 198 degrees, which is nearer due west than
    // south-west — and reading it as "south-west" because both signs are
    // negative is the mistake this asserts against. A first draft of the test
    // above made exactly that one.
    expect(
      offsetMetres(CENTRE, { x: CENTRE.x - 3, y: CENTRE.y - 1 }).bearing
    ).toBe('west');
  });

  it('names all eight compass points', () => {
    const at = (dx: number, dy: number) =>
      offsetMetres(CENTRE, { x: CENTRE.x + dx, y: CENTRE.y + dy }).bearing;
    expect(at(1, 0)).toBe('east');
    expect(at(1, 1)).toBe('north-east');
    expect(at(0, 1)).toBe('north');
    expect(at(-1, 1)).toBe('north-west');
    expect(at(-1, 0)).toBe('west');
    expect(at(-1, -1)).toBe('south-west');
    expect(at(0, -1)).toBe('south');
    expect(at(1, -1)).toBe('south-east');
  });

  it('agrees with the grid it measures, at a real latitude', () => {
    // The reason this is integer arithmetic rather than a Haversine:
    // `lonStepForRow` already scales longitude by the row's cosine, so one
    // cell east really is CELL_METRES east. If that ever stops being true,
    // this comparison against the actual cell centres is what catches it.
    const here = cellOf(35.0454, -85.3102);
    const east = { x: here.x + 1, y: here.y };
    const a = cellCentre(here);
    const b = cellCentre(east);
    const metresPerDegLon = 111_320 * Math.cos((a.lat * Math.PI) / 180);
    const measured = Math.abs(b.lon - a.lon) * metresPerDegLon;
    expect(measured).toBeCloseTo(CELL_METRES, 0);
    expect(offsetMetres(here, east).east).toBe(CELL_METRES);
  });
});

/**
 * ADJACENCY ON THE REAL WORLD (#86).
 *
 * Everything above this line uses `{x: 10, y: 20}`, and that is why everything
 * above this line was green while `grid3x3` named the wrong cell across 56% of
 * inhabited latitudes.
 *
 * Each row indexes its columns from the prime meridian using its OWN longitude
 * quantum, so column `x` in row `y + 1` is not above column `x` in row `y`. The
 * ground offset between them is grid convergence, and it has a closed form —
 * measured against this module to two decimals at four cities:
 *
 *     slide_per_row = CELL_METRES * λ * sin(φ)        (λ in RADIANS)
 *
 *     London       -0.17 m      Chattanooga   -85.50 m
 *     Singapore     4.28 m      Sydney       -147.07 m
 *
 * It reaches 100π ≈ 314 m at the antimeridian. Wherever it exceeds half a cell,
 * `{x: x + dx, y: y + dy}` names a cell the player is not next to.
 *
 * `{x: 10, y: 20}` sits at λ ≈ 0, where the slide measures 0.000 m. So does
 * Greenwich, and so does the equator (sin φ ≈ 0) — the two places `cell.ts` was
 * validated against are the two where this defect is structurally invisible.
 */
describe('adjacency on the real world (#86)', () => {
  const M_PER_DEG_LAT = 111_320;

  /** Real cities, far enough from λ = 0 that convergence exceeds half a cell. */
  const PLACES: ReadonlyArray<readonly [string, number, number]> = [
    ['Chattanooga', 35.0456, -85.3097],
    ['Sydney', -33.8688, 151.2093],
    ['Ushuaia', -54.8019, -68.303],
  ];

  /**
   * THE NEGATIVE CONTROL. London sits at λ ≈ 0, so it is already correct on
   * `main` and must stay correct. Without it, a change that broke the grid
   * outright would look identical to a change that fixed adjacency.
   */
  const CONTROL = ['London', 51.5074, -0.1278] as const;

  /** The cell you are actually standing in after walking `dx`/`dy` whole cells. */
  const walkTo = (from: Cell, dx: number, dy: number): Cell => {
    const p = cellCentre(from);
    const lat = p.lat + (dy * CELL_METRES) / M_PER_DEG_LAT;
    const lon =
      p.lon +
      (dx * CELL_METRES) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
    return cellOf(lat, lon);
  };

  for (const [name, lat, lon] of [...PLACES, CONTROL]) {
    it(`names the cell you actually reach, from every direction, at ${name}`, () => {
      const here = cellOf(lat, lon);
      const g = grid3x3(here);
      // Row-major, north-up: index 0 is north-west, 4 is here, 8 is south-east.
      const expected = [
        walkTo(here, -1, 1),
        walkTo(here, 0, 1),
        walkTo(here, 1, 1),
        walkTo(here, -1, 0),
        here,
        walkTo(here, 1, 0),
        walkTo(here, -1, -1),
        walkTo(here, 0, -1),
        walkTo(here, 1, -1),
      ];
      expect(g.map((c) => `${c.x}:${c.y}`)).toEqual(
        expected.map((c) => `${c.x}:${c.y}`)
      );
    });
  }

  it('reports the bearing and distance a player would actually walk', () => {
    // The target is `walkTo`, NOT `grid3x3(here)[1]`. Comparing the two
    // functions to each other passes on the broken code — they share the same
    // wrong arithmetic and agree with each other, which is a test that cannot
    // fail. `walkTo` is derived from `cellCentre`, so it is correct on both
    // sides of the fix and can therefore report one.
    for (const [, lat, lon] of PLACES) {
      const here = cellOf(lat, lon);
      const north = walkTo(here, 0, 1);
      const o = offsetMetres(here, north);
      expect({ east: o.east, north: o.north, bearing: o.bearing }).toEqual({
        east: 0,
        north: CELL_METRES,
        bearing: 'north',
      });
    }
  });

  it('puts the north cell due north on the ground, not merely at y + 1', () => {
    // The geometric statement of the same defect. At Chattanooga the centre of
    // `{x, y + 1}` sits 85.5 m WEST of the centre of `{x, y}`; at Sydney,
    // 147.1 m west. A cell one row up is only "north" if it is also above you.
    for (const [, lat, lon] of PLACES) {
      const here = cellOf(lat, lon);
      const a = cellCentre(here);
      const b = cellCentre(grid3x3(here)[1]);
      const eastwardDrift =
        (b.lon - a.lon) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
      expect(Math.abs(eastwardDrift)).toBeLessThan(CELL_METRES / 2);
      expect((b.lat - a.lat) * M_PER_DEG_LAT).toBeCloseTo(CELL_METRES, 0);
    }
  });
});
