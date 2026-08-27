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
