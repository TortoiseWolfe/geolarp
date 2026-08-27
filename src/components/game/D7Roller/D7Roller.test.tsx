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
    expect(screen.getByText(/Needs 13 or more/)).toBeInTheDocument();
    expect(screen.queryByText(/13-17/)).not.toBeInTheDocument();
    // The band still names the cell.
    expect(screen.getByText(/Moderate/)).toBeInTheDocument();
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

  it('hides the Character Point control when there are none to spend', () => {
    render(<D7Roller label="Search" rating={rating} availablePoints={0} />);
    expect(
      screen.queryByRole('button', { name: /one more Character Point/ })
    ).not.toBeInTheDocument();
  });

  it('spends Character Points as extra dice, and stops at the limit', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <D7Roller
        label="Search"
        rating={rating}
        availablePoints={2}
        onResult={onResult}
        rng={new Rng('deterministic')}
      />
    );
    const more = screen.getByRole('button', {
      name: 'Spend one more Character Point',
    });
    await user.click(more);
    await user.click(more);
    expect(more).toBeDisabled(); // cannot spend a third
    expect(screen.getByText('3d7+1 + 2d7')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(onResult).toHaveBeenCalled());
    const [result, spent] = onResult.mock.calls[0];
    expect(spent).toBe(2);
    expect(result.bonusDice).toBe(2);
    expect(result.faces.length).toBeGreaterThanOrEqual(5);
  });

  it('cannot spend below zero', () => {
    render(<D7Roller label="Search" rating={rating} availablePoints={2} />);
    expect(
      screen.getByRole('button', { name: 'Spend one fewer Character Point' })
    ).toBeDisabled();
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
 * The two spend bugs (#42), and why the original tests missed them.
 *
 * The shipped suite covered "stake some points, roll once". It never covered
 * rolling TWICE, and never covered rolling after the balance reached zero —
 * which is exactly where both defects lived. A playtester found them in the
 * first session.
 */
describe('the stake is per roll, and never exceeds the balance', () => {
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

  it('does not charge twice for one encounter', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <D7Roller
        label="Search"
        rating={rating}
        availablePoints={5}
        onResult={onResult}
        rng={new Rng('twice')}
      />
    );

    await user.click(
      screen.getByRole('button', { name: 'Spend one more Character Point' })
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult.mock.calls[0][1]).toBe(1);

    // The bug: `spend` survived the roll, so a second press paid again for the
    // same encounter.
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(onResult.mock.calls[1][1]).toBe(0);
  });

  it('never stakes more than the balance, and does not throw at zero', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    const { rerender } = render(
      <D7Roller
        label="Search"
        rating={rating}
        availablePoints={5}
        onResult={onResult}
        rng={new Rng('drain')}
      />
    );

    const more = screen.getByRole('button', {
      name: 'Spend one more Character Point',
    });
    for (let i = 0; i < 5; i += 1) await user.click(more);
    expect(screen.getByText('3d7+1 + 5d7')).toBeInTheDocument();

    // The purse empties while the component stays mounted — exactly what
    // happens after a real roll spends the last point.
    rerender(
      <D7Roller
        label="Search"
        rating={rating}
        availablePoints={0}
        onResult={onResult}
        rng={new Rng('drain')}
      />
    );

    // The stale stake must not survive the balance dropping.
    expect(screen.queryByText(/\+ 5d7/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(onResult.mock.calls[0][1]).toBe(0);
  });

  it('clears the stake between two different encounters', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <D7Roller
        label="Search"
        rating={rating}
        availablePoints={3}
        onResult={onResult}
        rng={new Rng('between')}
      />
    );
    await user.click(
      screen.getByRole('button', { name: 'Spend one more Character Point' })
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(onResult).toHaveBeenCalled());

    // The control returns to 0 of 3, not 1 of 3 — the player is not silently
    // holding a stake they did not re-choose.
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
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

  it('makes each stake an independent bet, not a deficit calculator', async () => {
    // With the stake outside the seed, a free failure would tell the player
    // exactly how many dice to buy. Raising a stake has to be a gamble.
    const seed = '-77750:39012@2026-08-28|2026-08-27T00:00:00.000Z|Scavenge';
    const totals = new Set<number>();
    for (const availablePoints of [0, 1, 2]) {
      const user = userEvent.setup();
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
      for (let i = 0; i < availablePoints; i += 1) {
        await user.click(
          screen.getByRole('button', { name: 'Spend one more Character Point' })
        );
      }
      await user.click(screen.getByRole('button', { name: 'Roll Search' }));
      await waitFor(() => expect(onResult).toHaveBeenCalled());
      totals.add(onResult.mock.calls[0][0].faces.slice(0, 3).join(','));
      view.unmount();
    }
    // Three different stakes, three genuinely different rolls.
    expect(totals.size).toBe(3);
  });

  it('still takes an injected rng first, so tests stay deterministic', async () => {
    const seed = 'ignored-because-rng-wins';
    const a = await rollOnce({ seed, rng: new Rng('explicit') });
    const b = await rollOnce({ seed, rng: new Rng('explicit') });
    expect(a).toBe(b);
  });
});
