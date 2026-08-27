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
