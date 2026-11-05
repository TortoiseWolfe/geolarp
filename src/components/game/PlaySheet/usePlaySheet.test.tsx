import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePlaySheet } from './usePlaySheet';
import { generateCharacter } from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';
import { loadLibrary, defaultStore } from '@/lib/geolarp/library';
import type { RollResult } from '@/lib/geolarp/dice';

/**
 * RESULTS ARE CRAFTED, NOT ROLLED, as in the encounter loop's payout tests: the
 * roller seeds from the character's creation time, so a real roll cannot be
 * pinned to a win or a miss. These drive `resolve` with what the roller sends.
 */
const DAY = new Date('2026-11-04T12:00:00Z');

const result = (
  success: boolean,
  purchases: Array<'die' | 'reroll'> = []
): RollResult => ({
  faces: [4, 4, 4],
  total: success ? 40 : 12,
  pips: 0,
  bonusDice: purchases.filter((p) => p === 'die').length,
  wild: 4,
  outcome: 'normal',
  success,
  purchases,
});

async function setup() {
  const hook = renderHook(() => usePlaySheet(DAY));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  act(() => {
    hook.result.current.addNew(generateCharacter('Ada Wren', new Rng('a')));
  });
  act(() => hook.result.current.selectSkill('Search'));
  return hook;
}

const stored = () => loadLibrary(defaultStore()!).characters[0];

describe('the wallet and its history', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts with 5 points and pays a first win by its band, then never again', async () => {
    const { result: r } = await setup();
    expect(r.current.character?.characterPoints).toBe(5);

    act(() => r.current.resolve(result(true), 0));
    // Moderate pays 1 (reward.ts).
    expect(stored().characterPoints).toBe(6);
    expect(stored().earnedToday).toBe(1);

    // Replaying the same win does not pay twice.
    act(() => r.current.resolve(result(true), 0));
    expect(stored().characterPoints).toBe(6);
    expect(stored().history).toHaveLength(1);
    expect(stored().history![0]).toMatchObject({ skill: 'Search', change: 1 });
  });

  it('pays a trivial win nothing on purpose, and says so in the history', async () => {
    const { result: r } = await setup();
    act(() => r.current.setDifficulty('very-easy'));
    act(() => r.current.resolve(result(true), 0));
    expect(stored().characterPoints).toBe(5);
    expect(stored().history![0].change).toBe(0);
    expect(stored().history![0].note).toMatch(/pays nothing, on purpose/);
  });

  it('bills a bought second chance once per point and records it', async () => {
    const { result: r } = await setup();
    act(() => r.current.resolve(result(false), 0));
    expect(stored().characterPoints).toBe(5);

    act(() => r.current.resolve(result(false, ['die']), 1));
    expect(stored().characterPoints).toBe(4);
    // A replay of the same state bills nothing.
    act(() => r.current.resolve(result(false, ['die']), 1));
    expect(stored().characterPoints).toBe(4);

    act(() => r.current.resolve(result(true, ['die', 'reroll']), 2));
    // One more point spent, then Moderate pays 1.
    expect(stored().characterPoints).toBe(3 + 1);
    const changes = stored().history!.map((h) => h.change);
    expect(changes).toEqual([-1, -1, 1]);
  });

  it('never earns past the daily cap of 5', async () => {
    const { result: r } = await setup();
    for (const d of ['very-difficult', 'heroic'] as const) {
      for (const skill of ['Search', 'Lore', 'Repair', 'Navigate'] as const) {
        act(() => r.current.setDifficulty(d));
        act(() => r.current.selectSkill(skill));
        act(() => r.current.resolve(result(true), 0));
      }
    }
    expect(stored().earnedToday).toBe(5);
    expect(stored().characterPoints).toBe(10);
  });

  it('never bills past the balance', async () => {
    const { result: r } = await setup();
    act(() => r.current.resolve(result(false), 0));
    act(() => r.current.resolve(result(false, ['die', 'die']), 9));
    expect(stored().characterPoints).toBe(0);
  });
});

describe('the library', () => {
  beforeEach(() => window.localStorage.clear());

  it('holds more than one character, switches, and removes', async () => {
    const { result: r } = await setup();
    act(() => {
      r.current.addNew({
        ...generateCharacter('Bram Holt', new Rng('b')),
        created: '2026-01-01T00:00:00.000Z',
      });
    });
    expect(r.current.library.characters.map((c) => c.name)).toEqual([
      'Ada Wren',
      'Bram Holt',
    ]);
    expect(r.current.character?.name).toBe('Bram Holt');

    act(() => r.current.select(r.current.library.characters[0].created));
    expect(r.current.character?.name).toBe('Ada Wren');

    act(() => r.current.remove(r.current.library.characters[0].created));
    expect(r.current.library.characters.map((c) => c.name)).toEqual([
      'Bram Holt',
    ]);
    // The mirrored single-character key follows the active sheet.
    expect(
      JSON.parse(window.localStorage.getItem('geolarp_character')!).name
    ).toBe('Bram Holt');
  });

  it('adopts the single character a browser already holds', async () => {
    window.localStorage.setItem(
      'geolarp_character',
      JSON.stringify(generateCharacter('Old Timer', new Rng('old')))
    );
    const hook = renderHook(() => usePlaySheet(DAY));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.character?.name).toBe('Old Timer');
  });
});
