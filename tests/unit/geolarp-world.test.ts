/**
 * The grid, the seed, the character and the encounter.
 *
 * The 100m quantisation is tested as a PRIVACY PROPERTY, not a rounding
 * helper: the published promise is that the game "never knows which building
 * you are in" (`the-world-is-the-board.md:87-90`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CELL_METRES,
  cellCentre,
  cellKey,
  cellOf,
  seedOf,
} from '@/lib/geolarp/cell';
import {
  ATTRIBUTES,
  ATTRIBUTE_DICE_BUDGET,
  ATTRIBUTE_MAX_DICE,
  ATTRIBUTE_MIN_DICE,
  Character,
  SKILLS,
  SKILL_DICE_BUDGET,
  SkillName,
  STORAGE_KEY,
  advance,
  fromExportJSON,
  generateCharacter,
  loadCharacter,
  ratingFor,
  saveCharacter,
  spendCharacterPoints,
  toExportJSON,
} from '@/lib/geolarp/character';
import { toPips, formatCode, roll } from '@/lib/geolarp/dice';
import { ENCOUNTER_KINDS, encounterFor } from '@/lib/geolarp/encounter';
import { Rng } from '@/lib/geolarp/rng';
import { LADDER } from '@/lib/geolarp/ladder';

describe('the 100m grid is the privacy promise', () => {
  // Downtown Chattanooga, where the 3D twin lives.
  const lat = 35.0456;
  const lon = -85.3097;
  const metresPerDegLat = 111_320;
  const mLat = (dm: number) => dm / metresPerDegLat;
  const mLon = (dm: number, atLat: number) =>
    dm / (metresPerDegLat * Math.cos((atLat * Math.PI) / 180));

  it('is constant across the tile it defines', () => {
    // The honest claim is not "anything within 100m shares a cell" — on ANY
    // grid two points 30m apart can straddle a boundary. It is that each cell
    // is one ~100m tile, so from its centre nothing within 40m escapes it.
    const home = cellOf(lat, lon);
    const c = cellCentre(home);
    for (const [dy, dx] of [
      [40, 0],
      [-40, 0],
      [0, 40],
      [0, -40],
      [30, 30],
      [-30, -30],
    ]) {
      const probe = cellOf(c.lat + mLat(dy), c.lon + mLon(dx, c.lat));
      expect(cellKey(probe)).toBe(cellKey(home));
    }
  });

  it('destroys sub-100m precision — the tile is at most CELL_METRES across', () => {
    const home = cellOf(lat, lon);
    // Walk north and east until the cell changes; that distance is the tile.
    const step = 0.5; // metres
    let north = 0;
    const c = cellCentre(home);
    while (cellKey(cellOf(c.lat + mLat(north), c.lon)) === cellKey(home)) {
      north += step;
      if (north > 500) break;
    }
    let east = 0;
    while (
      cellKey(cellOf(c.lat, c.lon + mLon(east, c.lat))) === cellKey(home)
    ) {
      east += step;
      if (east > 500) break;
    }
    // Half a tile in each direction from the centre, within a step of rounding.
    expect(north).toBeGreaterThan(CELL_METRES / 2 - 2);
    expect(north).toBeLessThan(CELL_METRES / 2 + 2);
    expect(east).toBeGreaterThan(CELL_METRES / 2 - 2);
    expect(east).toBeLessThan(CELL_METRES / 2 + 2);
  });

  it('never places a player more than half a diagonal from where they are', () => {
    // What the UI may show is the cell CENTRE, never the fix. Worst case is
    // half the diagonal of a 100m tile, ~71m.
    let worst = 0;
    for (let i = 0; i < 500; i += 1) {
      const testLat = lat + (i % 25) * 0.0004;
      const testLon = lon + Math.floor(i / 25) * 0.0004;
      const c = cellCentre(cellOf(testLat, testLon));
      const dy = (c.lat - testLat) * metresPerDegLat;
      const dx =
        (c.lon - testLon) *
        metresPerDegLat *
        Math.cos((testLat * Math.PI) / 180);
      worst = Math.max(worst, Math.hypot(dy, dx));
    }
    expect(worst).toBeLessThan(Math.hypot(CELL_METRES, CELL_METRES) / 2 + 1);
  });

  it('separates points a few hundred metres apart', () => {
    const home = cellOf(lat, lon);
    expect(cellKey(cellOf(lat + mLat(500), lon))).not.toBe(cellKey(home));
    expect(cellKey(cellOf(lat, lon + mLon(500, lat)))).not.toBe(cellKey(home));
  });

  it('keeps cells ~100m wide at every latitude, not just the equator', () => {
    for (const testLat of [0, 35, 60]) {
      const c = cellCentre(cellOf(testLat + 0.001, 0.001));
      let east = 0;
      const base = cellOf(c.lat, c.lon);
      while (
        cellKey(cellOf(c.lat, c.lon + mLon(east, c.lat))) === cellKey(base)
      ) {
        east += 0.5;
        if (east > 500) break;
      }
      // Without the cos(lat) correction this would shrink toward the poles.
      expect(east).toBeGreaterThan(CELL_METRES / 2 - 2);
      expect(east).toBeLessThan(CELL_METRES / 2 + 2);
    }
  });

  it('yields nothing but two integers', () => {
    const cell = cellOf(lat, lon);
    expect(Object.keys(cell).sort()).toEqual(['x', 'y']);
    expect(Number.isInteger(cell.x)).toBe(true);
    expect(Number.isInteger(cell.y)).toBe(true);
  });
});

describe('the seed is place AND date', () => {
  const cell = cellOf(35.0456, -85.3097);

  it('reseeds daily', () => {
    const mon = seedOf(cell, new Date('2026-08-24T12:00:00Z'));
    const tue = seedOf(cell, new Date('2026-08-25T12:00:00Z'));
    expect(mon).not.toBe(tue);
  });

  it('agrees for two players in the same cell on the same UTC day', () => {
    const morning = seedOf(cell, new Date('2026-08-24T00:30:00Z'));
    const evening = seedOf(cell, new Date('2026-08-24T23:30:00Z'));
    expect(morning).toBe(evening);
  });

  it('differs between cells on the same day', () => {
    const other = cellOf(35.0556, -85.3097);
    const day = new Date('2026-08-24T12:00:00Z');
    expect(seedOf(other, day)).not.toBe(seedOf(cell, day));
  });
});

describe('character generation', () => {
  it('spends the attribute budget exactly, within the floor and ceiling', () => {
    for (let s = 0; s < 50; s += 1) {
      const c = generateCharacter('Test', new Rng(s));
      const total = ATTRIBUTES.reduce((a, n) => a + c.attributes[n].dice, 0);
      expect(total).toBe(ATTRIBUTE_DICE_BUDGET);
      for (const n of ATTRIBUTES) {
        expect(c.attributes[n].dice).toBeGreaterThanOrEqual(ATTRIBUTE_MIN_DICE);
        expect(c.attributes[n].dice).toBeLessThanOrEqual(ATTRIBUTE_MAX_DICE);
        expect(c.attributes[n].pips).toBe(0);
      }
    }
  });

  it('spends the skill budget exactly, with at most one 2D focus', () => {
    for (let s = 0; s < 50; s += 1) {
      const c = generateCharacter('Test', new Rng(s));
      let spent = 0;
      let atTwoD = 0;
      for (const name of Object.keys(c.skills) as SkillName[]) {
        const over =
          toPips(c.skills[name]!) - toPips(c.attributes[SKILLS[name]]);
        expect(over).toBeGreaterThan(0);
        expect(over).toBeLessThanOrEqual(6); // 2D
        if (over > 3) atTwoD += 1;
        spent += over;
      }
      expect(spent).toBe(SKILL_DICE_BUDGET * 3);
      expect(atTwoD).toBeLessThanOrEqual(1);
    }
  });

  it('rolls an unraised skill at its governing attribute', () => {
    const names = Object.keys(SKILLS) as SkillName[];
    for (let s = 0; s < 20; s += 1) {
      const c = generateCharacter('Test', new Rng(s));
      const untrained = names.filter((n) => c.skills[n] === undefined);
      // 7D over 20 skills must leave most of the sheet alone, or the choice
      // of what to raise means nothing.
      expect(untrained.length).toBeGreaterThan(names.length / 3);
      for (const n of untrained) {
        expect(ratingFor(c, n)).toEqual(c.attributes[SKILLS[n]]);
      }
    }
  });

  it('never puts a skill below its governing attribute', () => {
    for (let s = 0; s < 50; s += 1) {
      const c = generateCharacter('Test', new Rng(s));
      for (const name of Object.keys(SKILLS) as SkillName[]) {
        expect(toPips(ratingFor(c, name))).toBeGreaterThanOrEqual(
          toPips(c.attributes[SKILLS[name]])
        );
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateCharacter('Ada', new Rng('seed'));
    const b = generateCharacter('Ada', new Rng('seed'));
    expect(a.attributes).toEqual(b.attributes);
    expect(a.skills).toEqual(b.skills);
  });
});

describe('advancement rolls pips into dice', () => {
  it('turns Xd7+3 into (X+1)d7', () => {
    expect(formatCode(advance({ dice: 3, pips: 1 }, 2))).toBe('4d7');
    expect(formatCode(advance({ dice: 3, pips: 0 }, 1))).toBe('3d7+1');
    expect(formatCode(advance({ dice: 3, pips: 2 }, 4))).toBe('5d7');
  });
});

describe('browser storage and export', () => {
  beforeEach(() => window.localStorage.clear());

  it('survives a save and load', () => {
    const c = generateCharacter('Ada', new Rng(1));
    saveCharacter(c);
    expect(loadCharacter()).toEqual(c);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('returns null rather than throwing on junk', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json');
    expect(loadCharacter()).toBeNull();
  });

  it('round-trips an exported file', () => {
    const c = generateCharacter('Ada', new Rng(2));
    expect(fromExportJSON(toExportJSON(c))).toEqual(c);
  });

  it('rejects a file that is not a character', () => {
    expect(() => fromExportJSON('{"version":99}')).toThrow(/geoLARP character/);
    expect(() => fromExportJSON(JSON.stringify({ version: 1 }))).toThrow(
      /missing attribute/
    );
  });
});

describe('encounters are a pure function of the seed', () => {
  it('gives the same encounter to everyone in the cell', () => {
    const seed = seedOf(
      cellOf(35.0456, -85.3097),
      new Date('2026-08-24T12:00:00Z')
    );
    expect(encounterFor(seed)).toEqual(encounterFor(seed));
  });

  it('produces all five published kinds across the grid', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      seen.add(encounterFor(`cell-${i}@2026-08-24`).kind);
    }
    expect([...seen].sort()).toEqual([...ENCOUNTER_KINDS].sort());
  });

  it('always names a real skill and a real difficulty', () => {
    const ladder = LADDER.map((b) => b.id);
    for (let i = 0; i < 200; i += 1) {
      const e = encounterFor(`cell-${i}@2026-08-24`);
      expect(Object.keys(SKILLS)).toContain(e.skill);
      expect(ladder).toContain(e.difficulty);
      expect(e.description.length).toBeGreaterThan(10);
    }
  });

  it('makes Heroic rare and the middle common', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i += 1) {
      const e = encounterFor(`cell-${i}@2026-08-24`);
      counts[e.difficulty] = (counts[e.difficulty] ?? 0) + 1;
    }
    expect(counts['heroic']).toBeLessThan(counts['moderate']);
    expect(counts['moderate']).toBeGreaterThan(2000 * 0.2);
  });
});

describe('character generation is fast enough for the ten-second target', () => {
  it('generates a thousand characters in well under a second', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i += 1) generateCharacter('Speed', new Rng(i));
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('Character Points buy dice', () => {
  it('adds ordinary dice, not wild ones', () => {
    const plain = roll({ dice: 3, pips: 0 }, new Rng('cp'), 13, 0);
    const boosted = roll({ dice: 3, pips: 0 }, new Rng('cp'), 13, 2);
    expect(boosted.bonusDice).toBe(2);
    // Same seed, same wild die: the bonus dice are appended, nothing shifts.
    expect(boosted.wild).toBe(plain.wild);
    expect(boosted.faces.length).toBe(plain.faces.length + 2);
    expect(boosted.total).toBeGreaterThan(plain.total);
  });

  it('raises the floor rather than the ceiling', () => {
    const rng = new Rng('cp-dist');
    let plainWins = 0;
    let boostedWins = 0;
    for (let i = 0; i < 4000; i += 1) {
      if (roll({ dice: 3, pips: 0 }, rng, 18, 0).success) plainWins += 1;
      if (roll({ dice: 3, pips: 0 }, rng, 18, 2).success) boostedWins += 1;
    }
    expect(boostedWins).toBeGreaterThan(plainWins * 1.5);
  });

  it('refuses to spend points a character does not have', () => {
    const c = generateCharacter('Test', new Rng(1));
    expect(spendCharacterPoints(c, 5).characterPoints).toBe(0);
    expect(() => spendCharacterPoints(c, 6)).toThrow(/only 5 Character Points/);
    expect(() => spendCharacterPoints(c, -1)).toThrow(/negative/);
  });
});
