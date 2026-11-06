import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import D7Roller from './D7Roller';
import { Rng } from '@/lib/geolarp/rng';
import { roll } from '@/lib/geolarp/dice';
import { bandOf } from '@/lib/geolarp/ladder';

/**
 * Every test injects a seeded RNG, so an assertion is about the component
 * rather than about luck.
 */
const rating = { dice: 3, pips: 1 };

describe('D7Roller', () => {
  beforeEach(() => {
    // jsdom has no matchMedia; the component treats its absence as "animate".
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows the rating as a dice code, not a number', () => {
    render(<D7Roller label="Search" rating={rating} />);
    expect(screen.getByText('3d7+1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
  });

  it('states the target as a FLOOR, never as a range', () => {
    render(<D7Roller label="Search" rating={rating} difficulty="moderate" />);
    // The band range is not a success window. `roll()` resolves
    // `total >= floor`, so 18 beats Moderate just as 13 does; printing
    // "Moderate (13-17)" said otherwise and was a real defect.
    // Scoped to the target line. A bare /Moderate/ matched the spend legend
    // too once it started naming the band you must beat to earn a point —
    // accessible names are an API in both directions, and so is body copy.
    const target = screen.getByText(/Needs 13 or more/);
    expect(target).toBeInTheDocument();
    expect(target.textContent).toContain('Moderate');
    expect(screen.queryByText(/13-17/)).not.toBeInTheDocument();
  });

  it('prices the roll before it is made, with no stake to set', () => {
    // The fix for the session that started all this: a playtester spent five
    // Character Points on a Heroic cell and lost, because nobody had shown them
    // the odds. The odds are still shown up front, and there is nothing to stake
    // before the dice are down any more (Jonathan's ruling, 4 Nov 2026).
    render(
      <D7Roller
        label="Search"
        rating={{ dice: 3, pips: 1 }}
        difficulty="heroic"
        availablePoints={5}
      />
    );
    expect(screen.getByText(/Chance on this roll/)).toHaveTextContent(
      'almost never'
    );
    expect(
      screen.queryByRole('button', { name: /Spend one more Character Point/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Chance at this stake/)).not.toBeInTheDocument();
  });

  it('says nothing about odds when there is no cell to have odds against', () => {
    // Same discipline as the "fixed until midnight" line: with no difficulty
    // there is no target, and inventing a percentage would be worse than
    // showing none.
    render(<D7Roller label="Search" rating={rating} />);
    expect(screen.queryByText(/Chance on this roll/)).not.toBeInTheDocument();
  });

  it('counts a roll above the band as a success', () => {
    // The regression this copy invited: a total of 18 against Moderate is a
    // success, and any UI that implies a ceiling is lying about the rules.
    const r = roll(
      { dice: 6, pips: 0 },
      new Rng('high'),
      bandOf('moderate').floor
    );
    expect(r.total).toBeGreaterThan(17);
    expect(r.success).toBe(true);
  });

  it('reports a total and an outcome after a roll', async () => {
    const user = userEvent.setup();
    render(
      <D7Roller
        label="Search"
        rating={rating}
        difficulty="moderate"
        rng={new Rng('deterministic')}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => {
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(
        /Search: rolled \d+ against Moderate, needing 13 or more — (success|failure)/
      );
    });
  });

  it('hands the caller the result and the points spent', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <D7Roller
        label="Brawl"
        rating={rating}
        onResult={onResult}
        rng={new Rng('deterministic')}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Brawl' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    const [result, spent] = onResult.mock.calls[0];
    expect(spent).toBe(0);
    expect(result.faces.length).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeGreaterThan(0);
  });

  it('renders the wild die first and labels it for a screen reader', async () => {
    const user = userEvent.setup();
    render(
      <D7Roller label="Search" rating={rating} rng={new Rng('deterministic')} />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    const list = await screen.findByRole('list', {
      name: 'Dice faces, wild die first',
    });
    await waitFor(() => {
      expect(list.querySelectorAll('li').length).toBeGreaterThanOrEqual(3);
    });
    expect(list.querySelectorAll('li')[0]).toHaveTextContent(/Wild die:/);
  });

  it('offers nothing to buy before the roll, and says when buying opens', () => {
    // No purchase before the roll: the dice come first, then the choice.
    render(
      <D7Roller
        label="Search"
        rating={rating}
        difficulty="difficult"
        availablePoints={5}
      />
    );
    expect(
      screen.queryByRole('button', { name: /Buy an extra die/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Buy a reroll/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Roll first\. Then you may spend Character Points/)
    ).toBeInTheDocument();
  });

  it('skips the animation entirely under prefers-reduced-motion', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    const user = userEvent.setup();
    render(
      <D7Roller label="Search" rating={rating} rng={new Rng('deterministic')} />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    // No "Rolling…" phase, and the result is present immediately.
    expect(
      screen.queryByRole('button', { name: 'Rolling…' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Roll result' })
    ).toHaveTextContent(/rolled \d+/);
  });

  it('clears a stale result when the rating changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <D7Roller label="Search" rating={rating} rng={new Rng('a')} />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/rolled/)
    );
    rerender(
      <D7Roller
        label="Search"
        rating={{ dice: 5, pips: 0 }}
        rng={new Rng('a')}
      />
    );
    expect(
      screen.getByRole('status', { name: 'Roll result' })
    ).toHaveTextContent('');
  });

  it('is reproducible for a given seed', async () => {
    // Reduced motion: this asserts the DICE are reproducible, and the 600ms
    // animation is decoration over a result computed up front. Rolling twice
    // through it put the test within a second of the 5s timeout, which is a
    // flake waiting for a slow runner rather than a property worth testing
    // here — the animated path has its own test above.
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const user = userEvent.setup();
    const totals: number[] = [];
    for (const _ of [0, 1]) {
      const onResult = vi.fn();
      const { unmount } = render(
        <D7Roller
          label="Search"
          rating={rating}
          onResult={onResult}
          rng={new Rng('same-seed')}
        />
      );
      await user.click(screen.getByRole('button', { name: 'Roll Search' }));
      await waitFor(() => expect(onResult).toHaveBeenCalled());
      totals.push(onResult.mock.calls[0][0].total);
      unmount();
    }
    expect(totals[0]).toBe(totals[1]);
  });
});

/**
 * Character Points are bought AFTER the roll (Jonathan's ruling, 4 Nov 2026).
 *
 * The earlier spend bugs (#42) were a stake that survived a roll and a stake
 * that outlived the balance. Both came from the stake being set BEFORE the dice.
 * The stake is gone, so those failure modes are gone with it; what replaces
 * them is a purchase rule: an extra die or a reroll, one point each, at most
 * two points on one roll, and only while the roll is still a miss.
 *
 * Heroic is the cell used throughout: with 3d7+1 against 35 a miss is near
 * certain, so each test starts from a roll with something to fix.
 */
describe('Character Points are bought after the roll', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  function heroic(points: number, onResult = vi.fn()) {
    const user = userEvent.setup();
    const view = render(
      <D7Roller
        label="Search"
        rating={rating}
        difficulty="heroic"
        availablePoints={points}
        onResult={onResult}
        rng={new Rng('heroic-miss')}
      />
    );
    return { user, onResult, ...view };
  }

  async function rollFirst(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await screen.findByRole('button', { name: /Buy an extra die/ });
  }

  it('reports the first roll as costing nothing', async () => {
    const { user, onResult } = heroic(5);
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult.mock.calls[0][1]).toBe(0);
  });

  it('buys an extra die for one point, keeping the dice already rolled', async () => {
    const { user, onResult } = heroic(5);
    await rollFirst(user);
    const before = onResult.mock.calls[0][0];
    await user.click(screen.getByRole('button', { name: /Buy an extra die/ }));
    expect(onResult).toHaveBeenCalledTimes(2);
    const [after, spent] = onResult.mock.calls[1];
    expect(spent).toBe(1);
    expect(after.bonusDice).toBe(1);
    expect(after.faces.slice(0, before.faces.length)).toEqual(before.faces);
    expect(after.faces).toHaveLength(before.faces.length + 1);
    expect(after.purchases).toEqual(['die']);
  });

  it('buys a reroll for one point, rolling the pool again', async () => {
    const { user, onResult } = heroic(5);
    await rollFirst(user);
    await user.click(screen.getByRole('button', { name: /Buy a reroll/ }));
    const [after, spent] = onResult.mock.calls[1];
    expect(spent).toBe(1);
    expect(after.purchases).toEqual(['reroll']);
    expect(after.bonusDice).toBe(0);
  });

  it('prices both options on the screen before the player picks', async () => {
    const { user } = heroic(5);
    await rollFirst(user);
    for (const name of [/Buy an extra die/, /Buy a reroll/]) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveTextContent('1 Character Point');
      expect(button).toHaveTextContent(/to win from here|almost/);
    }
  });

  it('stops at two points on one roll, across both options together', async () => {
    const { user, onResult } = heroic(5);
    await rollFirst(user);
    await user.click(screen.getByRole('button', { name: /Buy an extra die/ }));
    await user.click(screen.getByRole('button', { name: /Buy a reroll/ }));
    expect(onResult.mock.calls[2][1]).toBe(2);
    expect(
      screen.getByRole('button', { name: /Buy an extra die/ })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /Buy a reroll/ })).toBeDisabled();
    expect(
      screen.getByText(/2 Character Points a roll allows/)
    ).toBeInTheDocument();
    expect(onResult).toHaveBeenCalledTimes(3);
  });

  it('disables both buys with a reason when the player holds no points', async () => {
    const { user } = heroic(0);
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    expect(
      await screen.findByText(/No Character Points\. Beat a Moderate cell/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Buy an extra die/ })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /Buy a reroll/ })).toBeDisabled();
  });

  it('cannot buy more than the balance, so the purse never goes negative', async () => {
    const { user, onResult, rerender } = heroic(1);
    await rollFirst(user);
    await user.click(screen.getByRole('button', { name: /Buy a reroll/ }));
    expect(onResult.mock.calls[1][1]).toBe(1);
    // The caller deducts the point; the balance prop falls to zero.
    rerender(
      <D7Roller
        label="Search"
        rating={rating}
        difficulty="heroic"
        availablePoints={0}
        onResult={onResult}
        rng={new Rng('heroic-miss')}
      />
    );
    expect(
      screen.getByRole('button', { name: /Buy an extra die/ })
    ).toBeDisabled();
  });

  it('offers no purchase once the roll has beaten the cell', async () => {
    const user = userEvent.setup();
    render(
      <D7Roller
        label="Search"
        rating={{ dice: 6, pips: 0 }}
        difficulty="very-easy"
        availablePoints={5}
        rng={new Rng('easy')}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/success/)
    );
    expect(
      screen.queryByRole('button', { name: /Buy an extra die/ })
    ).not.toBeInTheDocument();
  });

  it('does not charge again when the player presses Roll after buying', async () => {
    // A cell-seeded roll replays the same dice and the same purchases, so the
    // second press shows the state the player paid for and bills nothing new.
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <D7Roller
        label="Search"
        rating={rating}
        difficulty="heroic"
        availablePoints={5}
        seed="cell|char|Search"
        onResult={onResult}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await user.click(
      await screen.findByRole('button', { name: /Buy an extra die/ })
    );
    const bought = onResult.mock.calls[1][0];
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(3));
    const [again, spent] = onResult.mock.calls[2];
    expect(spent).toBe(1);
    expect(again.faces).toEqual(bought.faces);
  });

  it('restores the purchases a cell already saw, and the cap with them', () => {
    const restored = {
      faces: [2, 3, 1, 4],
      total: 11,
      pips: 1,
      bonusDice: 1,
      wild: 2,
      outcome: 'normal' as const,
      success: false,
      purchases: ['die', 'reroll'] as Array<'die' | 'reroll'>,
    };
    render(
      <D7Roller
        label="Search"
        rating={rating}
        difficulty="heroic"
        availablePoints={3}
        restoredResult={restored}
      />
    );
    expect(
      screen.getByRole('button', { name: /Buy an extra die/ })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /Buy a reroll/ })).toBeDisabled();
  });
});

/**
 * Cell-seeded resolution (#42).
 *
 * WHAT EACH TEST ACTUALLY PROVES, because they are not equivalent. Only "gives
 * the same faces for the same cell" fails when the feature is removed —
 * verified by stubbing the seed out, which produced '2,3,4' against '2,1,3'.
 * The three "different faces" tests pass with or without it, because random
 * rolls also differ; they are guards against the opposite mistake, a seed too
 * coarse to distinguish one cell from its neighbour or today from tomorrow.
 */
describe('a cell-seeded roll is fixed until the world reseeds', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  async function rollOnce(
    props: Partial<React.ComponentProps<typeof D7Roller>>
  ) {
    const user = userEvent.setup();
    const onResult = vi.fn();
    const view = render(
      <D7Roller label="Search" rating={rating} onResult={onResult} {...props} />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(onResult).toHaveBeenCalled());
    // The FACES, not the total. A total is a small integer and two unrelated
    // seeds collide on one often — an assertion on it would pass or fail on
    // luck rather than on whether the seed is doing anything.
    const faces = (onResult.mock.calls[0][0].faces as number[]).join(',');
    view.unmount();
    return faces;
  }

  it('gives the same faces for the same cell, so re-rolling is pointless', async () => {
    const seed = '-77750:39012@2026-08-28|2026-08-27T00:00:00.000Z|Scavenge';
    const a = await rollOnce({ seed });
    const b = await rollOnce({ seed });
    expect(a).toBe(b);
  });

  it('gives different faces in a different cell', async () => {
    const base = '|2026-08-27T00:00:00.000Z|Scavenge';
    const a = await rollOnce({ seed: `-77750:39012@2026-08-28${base}` });
    const b = await rollOnce({ seed: `-77751:39012@2026-08-28${base}` });
    expect(a).not.toBe(b);
  });

  it('gives different faces tomorrow, because the world reseeds', async () => {
    const base = '-77750:39012@';
    const tail = '|2026-08-27T00:00:00.000Z|Scavenge';
    const a = await rollOnce({ seed: `${base}2026-08-28${tail}` });
    const b = await rollOnce({ seed: `${base}2026-08-29${tail}` });
    expect(a).not.toBe(b);
  });

  it('never changes the first roll when points are bought', async () => {
    // The first roll is a pure function of the cell. Buying afterwards adds to
    // it or replaces it, but cannot change what the cell first showed — so a
    // free miss reveals the deficit, and the pricing (one point, two at most)
    // is what keeps that from being a vending machine.
    const seed = '-77750:39012@2026-08-28|2026-08-27T00:00:00.000Z|Scavenge';
    const firsts = new Set<string>();
    for (const availablePoints of [0, 1, 5]) {
      const onResult = vi.fn();
      const view = render(
        <D7Roller
          label="Search"
          rating={rating}
          seed={seed}
          availablePoints={availablePoints}
          onResult={onResult}
        />
      );
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Roll Search' }));
      await waitFor(() => expect(onResult).toHaveBeenCalled());
      firsts.add(onResult.mock.calls[0][0].faces.join(','));
      view.unmount();
    }
    expect(firsts.size).toBe(1);
  });

  it('still takes an injected rng first, so tests stay deterministic', async () => {
    const seed = 'ignored-because-rng-wins';
    const a = await rollOnce({ seed, rng: new Rng('explicit') });
    const b = await rollOnce({ seed, rng: new Rng('explicit') });
    expect(a).toBe(b);
  });

  it('says the roll is fixed until midnight ONLY when a cell fixed it', async () => {
    // "How long does a turn last?" was asked in a playtest. The answer is
    // that there is no turn — the cell holds until the date rolls over.
    const user = userEvent.setup();
    const { unmount } = render(
      <D7Roller label="Search" rating={rating} seed="cell|char|Search" />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    expect(
      await screen.findByText(/fixed until midnight UTC/)
    ).toBeInTheDocument();
    unmount();

    // With no cell behind it the roller seeds from chance, so a re-roll gives
    // different dice and the sentence would be FALSE. This is the case that
    // is easiest to leave unchecked, which is why it is the one asserted.
    render(<D7Roller label="Search" rating={rating} />);
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/rolled/)
    );
    expect(screen.queryByText(/fixed until midnight/)).not.toBeInTheDocument();
  });
});
