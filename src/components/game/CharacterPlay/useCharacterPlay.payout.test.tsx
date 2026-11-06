import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCharacterPlay } from './useCharacterPlay';
import { loadCharacter } from '@/lib/geolarp/character';
import { rewardFor } from '@/lib/geolarp/reward';
import type { RollResult } from '@/lib/geolarp/dice';

/**
 * The payout moves from "first resolution" to "first WIN" (Jonathan's ruling,
 * 4 Nov 2026). With points bought after the roll, a player who misses and then
 * buys a reroll is still resolving the same cell; if a miss used up the one
 * payout the cell offers, the win they paid for would be worth nothing and the
 * council's return figures would not hold.
 *
 * RESULTS ARE CRAFTED, NOT ROLLED. The roller seeds from the character's
 * creation time, so a real roll cannot be pinned to a win or a miss; these
 * tests drive `resolve` directly with the results the roller would send.
 */

// A date whose cell pays, asserted below so the test cannot go vacuous.
const DAY = new Date('2026-08-28T12:00:00Z');

const miss = (purchases: Array<'die' | 'reroll'> = []): RollResult => ({
  faces: [4, 4, 4],
  total: 12,
  pips: 0,
  bonusDice: purchases.filter((p) => p === 'die').length,
  wild: 4,
  outcome: 'normal',
  success: false,
  purchases,
});

const win = (purchases: Array<'die' | 'reroll'> = []): RollResult => ({
  faces: [5, 5, 5],
  total: 40,
  pips: 0,
  bonusDice: purchases.filter((p) => p === 'die').length,
  wild: 5,
  outcome: 'normal',
  success: true,
  purchases,
});

async function setup() {
  window.localStorage.clear();
  const hook = renderHook(() =>
    useCharacterPlay(DAY, { locationFreeModes: true })
  );
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  act(() => hook.result.current.begin('Ada Wren'));
  await waitFor(() => expect(hook.result.current.encounter).not.toBeNull());
  act(() => hook.result.current.selectSkill('Search'));
  const reward = rewardFor(hook.result.current.encounter!.difficulty, win());
  // If this cell stops paying, pick another date: every case below is about
  // a payout, and zero would pass for the wrong reason.
  expect(reward).toBeGreaterThan(0);
  return { ...hook, reward };
}

const points = () => loadCharacter()?.characterPoints;

describe('the payout fires on the first WIN on a cell', () => {
  beforeEach(() => window.localStorage.clear());

  it('does not pay, or use up the payout, on a miss', async () => {
    const { result, reward } = await setup();
    act(() => result.current.resolve(miss(), 0));
    expect(points()).toBe(5);
    expect(result.current.earned).toBeNull();

    // The miss did not spend the cell's one payout: a reroll bought for one
    // point and won on pays in full.
    act(() => result.current.resolve(win(['reroll']), 1));
    expect(points()).toBe(5 - 1 + reward);
    expect(result.current.earned).toBe(reward);
  });

  it('pays once: a second win on the same cell pays nothing more', async () => {
    const { result, reward } = await setup();
    act(() => result.current.resolve(win(), 0));
    expect(points()).toBe(5 + reward);

    act(() => result.current.selectSkill('Lore'));
    act(() => result.current.resolve(win(), 0));
    expect(points()).toBe(5 + reward);
  });

  it('does not pay again when the same win is replayed', async () => {
    const { result, reward } = await setup();
    act(() => result.current.resolve(miss(), 0));
    act(() => result.current.resolve(win(['die']), 1));
    const paid = points();
    expect(paid).toBe(5 - 1 + reward);
    // The roller's Roll button replays the purchased state.
    act(() => result.current.resolve(win(['die']), 1));
    expect(points()).toBe(paid);
  });
});

describe('purchases are charged by the point, once', () => {
  it('bills each purchase when it is made and nothing on a replay', async () => {
    const { result } = await setup();
    act(() => result.current.resolve(miss(), 0));
    expect(points()).toBe(5);

    act(() => result.current.resolve(miss(['die']), 1));
    expect(points()).toBe(4);

    act(() => result.current.resolve(miss(['die', 'reroll']), 2));
    expect(points()).toBe(3);

    // Replaying the same state bills nothing.
    act(() => result.current.resolve(miss(['die', 'reroll']), 2));
    expect(points()).toBe(3);
  });

  it('never bills past the balance, so an arithmetic slip cannot crash the sheet', async () => {
    const { result } = await setup();
    act(() => result.current.resolve(miss(), 0));
    act(() => result.current.resolve(miss(['die', 'die']), 9));
    expect(points()).toBe(0);
  });
});
