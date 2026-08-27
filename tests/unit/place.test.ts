import { describe, it, expect } from 'vitest';
import { placeName, PLACE_NAME_SPACE } from '@/lib/geolarp/place';
import { Cell, cellKey, seedOf, grid3x3 } from '@/lib/geolarp/cell';
import { readFileSync } from 'node:fs';

const CELL: Cell = { x: -77750, y: 39012 };

describe('placeName', () => {
  it('is stable for a cell', () => {
    expect(placeName(CELL)).toBe(placeName(CELL));
  });

  it('DOES NOT CHANGE WHEN THE DAY DOES', () => {
    // The rule this file exists to protect. `seedOf` and `cellKey` look
    // interchangeable as seeds and one import would remove a line — but a
    // place whose name changes at midnight UTC is not a place. The encounter
    // reseeds daily; the ground does not.
    //
    // Asserted through the SEED rather than by stubbing the clock, because
    // `placeName` takes no date at all — which is itself the defence. If a
    // date parameter ever appears, this test is the thing that argues with it.
    const a = seedOf(CELL, new Date('2026-08-26T12:00:00Z'));
    const b = seedOf(CELL, new Date('2026-08-27T12:00:00Z'));
    expect(a).not.toBe(b);
    expect(placeName(CELL)).toBe(placeName(CELL));
    expect(placeName.length).toBe(1); // one parameter: the cell. No date.
  });

  it('does not read the encounter stream', () => {
    // Domain-prefixed, so a player cannot learn to read today's difficulty off
    // the name.
    //
    // Asserted on the IMPORT rather than on the file text: the first version
    // grepped the whole source for "seedOf" and failed on this module's own
    // doc comment, which explains at length why it must not use it. A probe
    // that fires on prose about the rule is not checking the rule.
    const src = readFileSync('src/lib/geolarp/place.ts', 'utf8');
    expect(src).toContain('`name:${cellKey(cell)}`');
    const imported = /import \{([^}]*)\} from '\.\/cell'/.exec(src)?.[1];
    expect(imported).toBeDefined();
    expect(imported).toContain('cellKey');
    expect(imported).not.toContain('seedOf');
  });

  it('gives neighbours different names', () => {
    // ">= 8 of 9 distinct" across sampled grids: with 8100 names a collision
    // inside one grid is possible and not a bug, but a systematic one is.
    for (const origin of [CELL, { x: 0, y: 0 }, { x: 12345, y: -678 }]) {
      const names = new Set(grid3x3(origin).map(placeName));
      expect(names.size).toBeGreaterThanOrEqual(8);
    }
  });

  it('reads as a landmark, never as an address', () => {
    // Two words, both capitalised, no digits and no street type. A name that
    // could pass for a geocoded address would make the app look like it knows
    // where you actually are, which is the one impression it must never give.
    const seen = new Set<string>();
    for (let x = -50; x < 50; x += 1) {
      for (let y = -50; y < 50; y += 1) {
        const name = placeName({ x, y });
        expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
        seen.add(name);
      }
    }
    // 10k samples over an 8100-name space: coverage should be broad, and a
    // seed that ignored one of its two words would collapse this hard.
    expect(seen.size).toBeGreaterThan(2000);
    expect(PLACE_NAME_SPACE).toBe(8100);
  });

  it('sits above the cell key rather than replacing it', () => {
    // The key stays sayable-by-nobody and checkable-by-anybody; the name is
    // the half a player can put in a sentence.
    expect(cellKey(CELL)).toBe('-77750:39012');
    expect(placeName(CELL)).not.toContain(':');
  });
});
