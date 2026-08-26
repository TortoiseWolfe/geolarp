import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import CharacterPlay from './CharacterPlay';

expect.extend(toHaveNoViolations);

const today = new Date('2026-08-26T12:00:00Z');

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    position: null,
    error: null,
    permission: 'prompt' as PermissionState,
    isSupported: true,
    getCurrentPosition: vi.fn(),
    clearWatch: vi.fn(),
    distanceFrom: () => null,
    loading: false,
  }),
}));

describe('CharacterPlay Accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  async function begin() {
    const user = userEvent.setup();
    const view = render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    await user.type(screen.getByLabelText('Name'), 'Ada Wren');
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Ada Wren', level: 2 });
    return { user, view };
  }

  it('has no violations on the creation form', async () => {
    const { container } = render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('labels the name field', async () => {
    render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('id', 'character-name');
  });

  it('has no violations while playing', async () => {
    const { view } = await begin();
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it('has no violations with the roller open', async () => {
    const { user, view } = await begin();
    await user.click(screen.getAllByRole('button', { name: /^Search/ })[0]);
    await screen.findByRole('button', { name: 'Roll Search' });
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it('has no violations in grid mode', async () => {
    const { user, view } = await begin();
    await user.click(screen.getByRole('button', { name: 'Grid movement' }));
    await screen.findByRole('group', { name: 'Move one cell' });
    expect(await axe(view.container)).toHaveNoViolations();
  });

  it('reports the selected location mode with aria-pressed', async () => {
    const { user } = await begin();
    const zone = screen.getByRole('button', { name: 'Pick a zone' });
    const grid = screen.getByRole('button', { name: 'Grid movement' });
    expect(zone).toHaveAttribute('aria-pressed', 'true');
    expect(grid).toHaveAttribute('aria-pressed', 'false');
    await user.click(grid);
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    expect(zone).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts headings at level 2, leaving h1 to the page', async () => {
    await begin();
    // The route owns the h1; a component that emits its own would produce two.
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
    expect(
      screen.getAllByRole('heading', { level: 2 }).length
    ).toBeGreaterThanOrEqual(2);
  });

  it('gives every control a 44px touch target', async () => {
    const { view } = await begin();
    const controls = view.container.querySelectorAll('button, input, select');
    expect(controls.length).toBeGreaterThan(10);
    controls.forEach((c) => expect(c.className).toContain('min-h-11'));
  });

  it('uses no dimmed text anywhere', async () => {
    const { view } = await begin();
    expect(view.container.innerHTML).not.toMatch(/text-base-content\/\d/);
    expect(view.container.innerHTML).not.toMatch(/\bopacity-\d/);
  });
});
