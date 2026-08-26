import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import D7Roller from './D7Roller';
import { Rng } from '@/lib/geolarp/rng';

expect.extend(toHaveNoViolations);

/**
 * The generated template rendered this component bare, which passed
 * vacuously — with no required props it produced an empty div. Every case
 * below renders it as it is actually used.
 */
const rating = { dice: 3, pips: 1 };

describe('D7Roller Accessibility', () => {
  beforeEach(() => {
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
  });

  it('has no violations at rest', async () => {
    const { container } = render(
      <D7Roller label="Search" rating={rating} difficulty="moderate" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with the Character Point control shown', async () => {
    const { container } = render(
      <D7Roller label="Search" rating={rating} availablePoints={3} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations once dice are on screen', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <D7Roller
        label="Search"
        rating={rating}
        difficulty="difficult"
        availablePoints={2}
        rng={new Rng('a11y')}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/rolled/)
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces the result in a live region', async () => {
    const user = userEvent.setup();
    render(<D7Roller label="Search" rating={rating} rng={new Rng('a11y')} />);
    // The region exists BEFORE the result, or a replacement is not announced.
    const status = screen.getByRole('status', { name: 'Roll result' });
    expect(status).toHaveAttribute('aria-live', 'polite');
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));
    await waitFor(() => expect(status).toHaveTextContent(/rolled/));
  });

  it('gives every control a 44px touch target', () => {
    const { container } = render(
      <D7Roller label="Search" rating={rating} availablePoints={2} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(2);
    buttons.forEach((b) => expect(b.className).toContain('min-h-11'));
  });

  it('labels the section by its heading', () => {
    const { container } = render(<D7Roller label="Brawl" rating={rating} />);
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('aria-labelledby', 'd7-brawl-heading');
    expect(screen.getByRole('heading', { name: 'Brawl' })).toHaveAttribute(
      'id',
      'd7-brawl-heading'
    );
  });
});
