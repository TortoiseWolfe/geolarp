import { describe, it, expect } from 'vitest';
import {
  LIBRARY_KEY,
  LIBRARY_LIMIT,
  addCharacter,
  exportFileName,
  importCharacterFile,
  loadLibrary,
  removeCharacter,
  saveLibrary,
} from '@/lib/geolarp/library';
import {
  CharacterStore,
  STORAGE_KEY,
  generateCharacter,
  toExportJSON,
} from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';

function memory(): CharacterStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const ada = () => generateCharacter('Ada Wren', new Rng('ada'));

describe('library storage', () => {
  it('round-trips through a store and mirrors the active character', () => {
    const store = memory();
    const lib = addCharacter(loadLibrary(store), ada())!;
    saveLibrary(lib, store);
    expect(loadLibrary(store).characters).toHaveLength(1);
    expect(JSON.parse(store.data.get(STORAGE_KEY)!).name).toBe('Ada Wren');
  });

  it('reads a corrupt library as empty instead of throwing', () => {
    const store = memory();
    store.setItem(LIBRARY_KEY, '{not json');
    expect(loadLibrary(store).characters).toEqual([]);
  });

  it('stops at the limit', () => {
    let lib = loadLibrary(memory());
    for (let i = 0; i < LIBRARY_LIMIT; i += 1) {
      const c = {
        ...ada(),
        created: `2026-11-04T00:00:${String(i).padStart(2, '0')}.000Z`,
      };
      lib = addCharacter(lib, c)!;
    }
    expect(addCharacter(lib, ada())).toBeNull();
  });

  it('removing the active character activates a neighbour; removing the last empties it', () => {
    let lib = loadLibrary(memory());
    const a = { ...ada(), created: '2026-11-04T00:00:01.000Z' };
    const b = { ...ada(), name: 'Bram', created: '2026-11-04T00:00:02.000Z' };
    lib = addCharacter(addCharacter(lib, a)!, b)!;
    lib = removeCharacter(lib, b.created);
    expect(lib.activeId).toBe(a.created);
    lib = removeCharacter(lib, a.created);
    expect(lib.activeId).toBeNull();
  });
});

describe('importing a file', () => {
  it('accepts what export wrote', () => {
    const c = ada();
    const back = importCharacterFile(toExportJSON(c));
    expect(back.name).toBe('Ada Wren');
    expect(back.attributes).toEqual(c.attributes);
    expect(back.skills).toEqual(c.skills);
  });

  const mutate = (f: (o: Record<string, unknown>) => void) => {
    const o = JSON.parse(toExportJSON(ada())) as Record<string, unknown>;
    f(o);
    return JSON.stringify(o);
  };

  it.each([
    ['not json', 'hello', /not a geoLARP character/],
    [
      'wrong version',
      mutate((o) => (o.version = 2)),
      /not a geoLARP character/,
    ],
    ['no name', mutate((o) => (o.name = '   ')), /no character name/],
    [
      'negative points',
      mutate((o) => (o.characterPoints = -3)),
      /Character Points/,
    ],
    [
      'huge points',
      mutate((o) => (o.characterPoints = 1e9)),
      /Character Points/,
    ],
    [
      'bad attribute',
      mutate(
        (o) =>
          ((o.attributes as Record<string, unknown>).Luck = {
            dice: 99,
            pips: 0,
          })
      ),
      /bad Luck/,
    ],
    ['bad date', mutate((o) => (o.created = 'tomorrow')), /creation date/],
  ])('refuses a file with %s', (_label, text, message) => {
    expect(() => importCharacterFile(text)).toThrow(message);
  });

  it('drops unknown skills and unknown fields rather than keeping them', () => {
    const back = importCharacterFile(
      mutate((o) => {
        (o.skills as Record<string, unknown>).Hacking = { dice: 5, pips: 0 };
        o.isAdmin = true;
      })
    );
    expect(back.skills).not.toHaveProperty('Hacking');
    expect(back).not.toHaveProperty('isAdmin');
  });

  it('caps the ledger and the name', () => {
    const history = Array.from({ length: 200 }, () => ({
      day: '2026-11-04',
      skill: 'Search',
      change: 1,
      note: 'x'.repeat(500),
    }));
    const back = importCharacterFile(
      mutate((o) => {
        o.history = history;
        o.name = 'N'.repeat(500);
      })
    );
    expect(back.history).toHaveLength(50);
    expect(back.history![0].note.length).toBe(120);
    expect(back.name.length).toBe(40);
  });

  it('names a file safely', () => {
    expect(exportFileName({ ...ada(), name: '../../Ada Wren!' })).toBe(
      'geolarp-ada-wren.json'
    );
    expect(exportFileName({ ...ada(), name: '###' })).toBe(
      'geolarp-character.json'
    );
  });
});
