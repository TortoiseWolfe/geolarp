/**
 * The storage seam that lets the rules layer run on React Native.
 *
 * The bug this file pins: `saveCharacter` used to guard on
 * `typeof window === 'undefined'`. React Native DEFINES `window` and does not define
 * `window.localStorage`, so on a phone the guard was false and the next line threw on
 * `undefined`. `loadCharacter` survived on its try/catch; the writer had none, so the
 * first save crashed the app.
 *
 * Every test here therefore has a negative control, because a test that cannot fail is
 * not evidence. The RN simulation below reproduces the old crash against a local copy of
 * the old code, so this file proves the bug was real rather than asserting it was.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  generateCharacter,
  loadCharacter,
  saveCharacter,
  setDefaultCharacterStore,
  STORAGE_KEY,
  type CharacterStore,
} from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';

function memoryStore(): CharacterStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const char = () => generateCharacter('Vector', new Rng('seam'));

describe('CharacterStore seam', () => {
  afterEach(() => {
    // jsdom provides localStorage, so re-detecting restores the web default.
    setDefaultCharacterStore({
      getItem: (k) => window.localStorage.getItem(k),
      setItem: (k, v) => window.localStorage.setItem(k, v),
      removeItem: (k) => window.localStorage.removeItem(k),
    });
    window.localStorage.clear();
  });

  it('round-trips through an injected store without touching localStorage', () => {
    const store = memoryStore();
    const c = char();
    saveCharacter(c, store);

    expect(store.map.has(STORAGE_KEY)).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadCharacter(store)?.name).toBe('Vector');
  });

  it('can fail: an empty store returns null rather than a character', () => {
    expect(loadCharacter(memoryStore())).toBeNull();
  });

  it('still uses localStorage on the web with no configuration', () => {
    const c = char();
    saveCharacter(c);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Vector');
    expect(loadCharacter()?.name).toBe('Vector');
  });

  describe('the React Native shape: window exists, window.localStorage does not', () => {
    /** The guard exactly as it was before this seam existed. */
    function oldSaveCharacter(value: string): void {
      if (typeof window === 'undefined') return;
      (window as unknown as { localStorage: Storage }).localStorage.setItem(
        STORAGE_KEY,
        value
      );
    }

    it('can fail: the OLD guard throws under the RN shape (this is the bug)', () => {
      const spy = vi
        .spyOn(globalThis, 'localStorage', 'get')
        .mockReturnValue(undefined as unknown as Storage);
      try {
        // `window` is defined, so `typeof window === 'undefined'` is false and the
        // next line dereferences undefined. This is what shipped.
        expect(() => oldSaveCharacter('{}')).toThrow();
      } finally {
        spy.mockRestore();
      }
    });

    it('the new code writes to the injected store instead, and never throws', () => {
      const store = memoryStore();
      const spy = vi
        .spyOn(globalThis, 'localStorage', 'get')
        .mockReturnValue(undefined as unknown as Storage);
      try {
        setDefaultCharacterStore(store);
        expect(() => saveCharacter(char())).not.toThrow();
        expect(store.map.has(STORAGE_KEY)).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });
  });

  it('survives a store that throws on write, because a device may refuse one', () => {
    const hostile: CharacterStore = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
      removeItem: () => {},
    };
    expect(() => saveCharacter(char(), hostile)).not.toThrow();
  });

  it('can fail: a store that throws on READ yields null, not an exception', () => {
    const hostile: CharacterStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadCharacter(hostile)).toBeNull();
  });
});
