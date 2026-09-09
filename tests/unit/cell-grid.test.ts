import { describe, it, expect } from 'vitest';
import {
  Cell,
  CELL_METRES,
  ROW_METRES,
  HEX_DIRECTIONS,
  flower,
  neighbour,
  offsetMetres,
  cellOf,
  cellCentre,
} from '@/lib/geolarp/cell';

const CENTRE: Cell = { q: 10, r: 20 };

describe('flower', () => {
  it('is seven cells with the given one in the middle', () => {
    const f = flower(CENTRE);
    expect(f).toHaveLength(7);
    expect(f[3]).toEqual(CENTRE);
  });

  it('is NORTH-UP and 2-3-2, so a renderer can lay it out in rows', () => {
    // The bug this prevents draws the world upside down, and looks fine until
    // someone walks north and the highlight moves the wrong way.
    const f = flower(CENTRE);
    // Row 0 is the northern PAIR, row 2 the southern pair.
    expect(f[0].r).toBeGreaterThan(f[3].r);
    expect(f[1].r).toBeGreaterThan(f[3].r);
    expect(f[5].r).toBeLessThan(f[3].r);
    expect(f[6].r).toBeLessThan(f[3].r);
    // The middle row shares the centre's row exactly — those are the flat sides.
    expect(f[2].r).toBe(CENTRE.r);
    expect(f[4].r).toBe(CENTRE.r);
    expect(f[2].q).toBe(CENTRE.q - 1);
    expect(f[4].q).toBe(CENTRE.q + 1);
  });

  it('has no duplicates', () => {
    const keys = new Set(flower(CENTRE).map((c) => `${c.q}:${c.r}`));
    expect(keys.size).toBe(7);
  });

  /**
   * THERE IS NO DUE NORTH, and that is the visible cost of the conversion (#87).
   *
   * A pointy-top hex has flat sides east and west, so nothing sits straight up.
   * Asserted rather than left implicit: if a seventh direction ever appears, it
   * means someone has gone back to a square-ish lattice and the equidistance
   * this file exists to check has quietly gone with it.
   */
  it('offers six directions, and north is not one of them', () => {
    expect([...HEX_DIRECTIONS]).toHaveLength(6);
    expect(HEX_DIRECTIONS).not.toContain('north');
    expect(HEX_DIRECTIONS).not.toContain('south');
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

  /**
   * EAST COMES IN HALVES NOW. The stagger puts odd rows half a column east, so a
   * cross-row step is (±50, ±86.6) and an in-row step is (±100, 0). Both measure
   * 100 m, which is the entire point of the lattice — the square grid could not
   * say that of its diagonals, which were 141 m.
   */
  it('measures one step as 100 m in every one of the six directions', () => {
    // At the equator the lattice is unsheared, so this is the ideal case and the
    // numbers are exact. Real latitudes are checked further down, where they are
    // not exact and the envelope is measured rather than assumed.
    const here = cellOf(0.0004, 0.0004);
    for (const d of HEX_DIRECTIONS) {
      const o = offsetMetres(here, neighbour(here, d));
      expect(Math.round(o.metres)).toBe(100);
    }
  });

  it('signs west and south negative', () => {
    const o = offsetMetres(CENTRE, { q: CENTRE.q - 3, r: CENTRE.r });
    expect(o.east).toBe(-300);
    expect(o.bearing).toBe('west');
  });

  it('counts rows in ROW_METRES, not CELL_METRES', () => {
    // The row pitch of a pointy-top lattice is √3/2 of the flat-to-flat width.
    // Using CELL_METRES here would overstate every north-south distance by 15.5%.
    const o = offsetMetres(CENTRE, { q: CENTRE.q, r: CENTRE.r + 2 });
    expect(o.north).toBeCloseTo(2 * ROW_METRES, 6);
    expect(ROW_METRES).toBeCloseTo(86.6025403784, 9);
  });

  it('agrees with the grid it measures, at a real latitude', () => {
    // The reason this is lattice arithmetic rather than a Haversine:
    // `lonStepForRow` already scales longitude by the row's cosine, so one cell
    // east really is CELL_METRES east. If that stops being true, this comparison
    // against the actual cell centres is what catches it.
    const here = cellOf(35.0454, -85.3102);
    const east = { q: here.q + 1, r: here.r };
    const a = cellCentre(here);
    const b = cellCentre(east);
    const metresPerDegLon = 111_320 * Math.cos((a.lat * Math.PI) / 180);
    const measured = Math.abs(b.lon - a.lon) * metresPerDegLon;
    expect(measured).toBeCloseTo(CELL_METRES, 0);
    expect(offsetMetres(here, east).east).toBeCloseTo(CELL_METRES, 6);
  });
});

/**
 * EQUIDISTANCE ON THE REAL WORLD (#87, and #86 before it).
 *
 * Everything above this line uses `{q: 10, r: 20}` or the equator, and that is
 * exactly why everything above this line would stay green on a broken lattice.
 *
 * Each row indexes its columns from the prime meridian using its OWN longitude
 * quantum, so the rows are offset from one another like brick courses. The ground
 * offset per row is grid convergence, `CELL_METRES · λ · sin φ`, reaching
 * `100π ≈ 314 m` at the antimeridian and 0 at Greenwich. `{q: 10, r: 20}` sits at
 * λ ≈ 0 where it measures 0.000 m, and so does the equator — the two places this
 * module is most naturally validated against are the two where the defect is
 * structurally invisible.
 *
 * WHAT THE CONVERSION BOUGHT, measured through `cellCentre` on both lattices:
 *
 *     max/min ground distance to all neighbours
 *                     square (8)    hex (6)
 *     equator            1.414       1.000
 *     London             1.415       1.001
 *     Chattanooga        1.520       1.282
 *     Sydney             1.779       1.297
 *     Auckland           1.540       1.449
 *     mean               1.557       1.226
 *
 * Hexes are better everywhere, INCLUDING under the shear, because the shear lands
 * on an already-141 m diagonal in the square case.
 *
 * They are not perfect and the margin is not uniform. At Auckland (λ = 174.8, near
 * the antimeridian where convergence peaks) hexes measure 1.449 against the square's
 * 1.540 — an improvement, but WORSE than the square grid's unsheared 1.414. So the
 * baseline below is per-city and measured, never the ideal: comparing a sheared
 * lattice against an unsheared ideal is a mistake this file made once.
 */
describe('equidistance on the real world (#87)', () => {
  const M_PER_DEG_LAT = 111_320;

  const ground = (a: { lat: number; lon: number }, b: typeof a) => {
    const dN = (b.lat - a.lat) * M_PER_DEG_LAT;
    const dE =
      (b.lon - a.lon) * M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dN, dE);
  };

  /**
   * Real cities, far enough from λ = 0 that convergence exceeds half a cell, each
   * with the SQUARE grid's measured ratio at that same place.
   *
   * The baseline has to be per-city, not the square's ideal 1.414. Auckland is why:
   * at λ = 174.8 the shear is near its maximum, the hex ratio is 1.449, and a
   * comparison against 1.414 fails while the conversion is still an improvement —
   * the square grid measures 1.540 at that same spot. Comparing a sheared lattice
   * against an unsheared ideal is the mistake, and this file made it once.
   */
  const PLACES: ReadonlyArray<readonly [string, number, number, number]> = [
    ['Chattanooga', 35.0456, -85.3097, 1.52],
    ['Sydney', -33.8688, 151.2093, 1.779],
    ['Auckland', -36.8485, 174.7633, 1.54],
  ];

  /**
   * THE NEGATIVE CONTROL. London sits at λ ≈ 0, so it is unsheared and must be
   * essentially exact. Without it, a change that broke the lattice outright would
   * look identical to a change that merely tolerates the shear.
   */
  it('is exact where there is no shear (London, λ ≈ 0)', () => {
    const here = cellOf(51.5074, -0.1278);
    const o = cellCentre(here);
    const ds = HEX_DIRECTIONS.map((d) =>
      ground(o, cellCentre(neighbour(here, d)))
    );
    expect(Math.max(...ds) / Math.min(...ds)).toBeLessThan(1.01);
    for (const d of ds) expect(d).toBeCloseTo(CELL_METRES, 0);
  });

  it('beats the square grid at every city, shear included', () => {
    for (const [name, lat, lon, squareRatio] of PLACES) {
      const here = cellOf(lat, lon);
      const o = cellCentre(here);
      const ds = HEX_DIRECTIONS.map((d) =>
        ground(o, cellCentre(neighbour(here, d)))
      );
      const ratio = Math.max(...ds) / Math.min(...ds);
      expect(
        ratio,
        `${name}: hex ${ratio.toFixed(3)} must beat square ${squareRatio}`
      ).toBeLessThan(squareRatio);
      // And the envelope: nothing may collapse onto another cell or fly off.
      expect(Math.min(...ds), name).toBeGreaterThan(80);
      expect(Math.max(...ds), name).toBeLessThan(130);
    }
  });

  /**
   * The six neighbours must be six DIFFERENT cells, and none of them the centre.
   *
   * This is the assertion that catches a stagger applied with the wrong sign. JS
   * `%` keeps the sign of the dividend, so `-3 % 2 === -1`: a naive parity test
   * staggers the southern hemisphere the wrong way, and the failure mode is two
   * "neighbours" collapsing onto one cell. Sydney and Auckland are here for that
   * reason and not for variety.
   */
  it('names six distinct cells, none of them the centre', () => {
    for (const [name, lat, lon] of [
      ...PLACES,
      ['London', 51.5074, -0.1278] as const,
      ['equator', 0.0004, 0.0004] as const,
    ]) {
      const here = cellOf(lat, lon);
      const keys = HEX_DIRECTIONS.map((d) => {
        const n = neighbour(here, d);
        return `${n.q}:${n.r}`;
      });
      expect(new Set(keys).size, `${name}: ${keys.join(' ')}`).toBe(6);
      expect(keys, name).not.toContain(`${here.q}:${here.r}`);
    }
  });

  /**
   * `cellCentre(cellOf(p))` must be an exact fixed point, or quantising at the
   * boundary would change which encounter a player meets. Swept globally rather
   * than at the handful of cities above, because the stagger is parity-dependent
   * and a bug in it would hide on whichever parity the fixtures happen to hit.
   */
  it('round-trips exactly, globally', () => {
    let checked = 0;
    for (let i = 0; i < 4000; i++) {
      const lat = -75 + (i * 150) / 4000;
      const lon = -180 + ((i * 227) % 360);
      const c = cellOf(lat, lon);
      const centre = cellCentre(c);
      expect(cellOf(centre.lat, centre.lon)).toEqual(c);
      checked += 1;
    }
    expect(checked).toBe(4000);
  });
});
