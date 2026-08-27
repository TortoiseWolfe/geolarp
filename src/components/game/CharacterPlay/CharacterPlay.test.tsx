import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CharacterPlay from './CharacterPlay';
import { STORAGE_KEY, loadCharacter } from '@/lib/geolarp/character';

const today = new Date('2026-08-26T12:00:00Z');

const mockGeo = vi.hoisted(() => ({
  position: null as GeolocationPosition | null,
  error: null as GeolocationPositionError | null,
  getCurrentPosition: vi.fn(),
}));

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    ...mockGeo,
    permission: 'prompt',
    isSupported: true,
    clearWatch: vi.fn(),
    distanceFrom: () => null,
    loading: false,
  }),
}));

describe('CharacterPlay', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGeo.position = null;
    mockGeo.error = null;
    mockGeo.getCurrentPosition = vi.fn();
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

  afterEach(() => vi.restoreAllMocks());

  async function begin(name = 'Ada Wren') {
    const user = userEvent.setup();
    render(<CharacterPlay today={today} />);
    await screen.findByRole('heading', { name: 'Make a character' });
    if (name) await user.type(screen.getByLabelText('Name'), name);
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name, level: 2 });
    return user;
  }

  it('offers character creation when the browser holds none', async () => {
    render(<CharacterPlay today={today} />);
    expect(
      await screen.findByRole('heading', { name: 'Make a character' })
    ).toBeInTheDocument();
  });

  it('creates a character and persists it', async () => {
    await begin('Ada Wren');
    const stored = loadCharacter();
    expect(stored?.name).toBe('Ada Wren');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Ada Wren');
  });

  it('falls back to a default name rather than an empty sheet', async () => {
    const user = userEvent.setup();
    render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    expect(
      await screen.findByRole('heading', { name: 'Wanderer', level: 2 })
    ).toBeInTheDocument();
  });

  it('reloads an existing character instead of asking again', async () => {
    await begin('Ada Wren');
    const { unmount } = render(<CharacterPlay today={today} />);
    unmount();
    render(<CharacterPlay today={today} />);
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Make a character' })
      ).not.toBeInTheDocument()
    );
  });

  it('opens the rules for a new player and shuts them once they have one', async () => {
    const user = userEvent.setup();
    render(<CharacterPlay today={today} />);

    const openPrimer = (await screen.findByText('How geoLARP works')).closest(
      'details'
    ) as HTMLDetailsElement;
    expect(openPrimer.open).toBe(true);
    // The answer to "how long does a turn last?", which is what a first-time
    // player is actually holding the page open to find out.
    expect(
      within(openPrimer).getByText(/There are no turns/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Wanderer', level: 2 });

    // Shut, WITHOUT a second localStorage key: the character record is the
    // visit memory. `/privacy-controls` preserves exactly one key by name, so
    // a `geolarp_intro_seen` flag would be wiped there without a word.
    const shutPrimer = screen
      .getByText('How geoLARP works')
      .closest('details') as HTMLDetailsElement;
    expect(shutPrimer.open).toBe(false);
    expect(window.localStorage.length).toBe(1);
  });

  it('jumps to the skill the cell suggests, taking focus with it', async () => {
    const user = await begin();
    const jump = screen.getByRole('button', { name: /^Go to / });
    const suggested = jump.textContent!.replace('Go to ', '').trim();

    await user.click(jump);

    const row = screen.getByRole('button', {
      name: new RegExp(`^${suggested} `),
    });
    // FOCUS, not just selection. The sheet sits two to three phone screens
    // below the card, so a jump that only changes state moves something the
    // player cannot see — which is the defect this button replaced.
    expect(document.activeElement).toBe(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
  });

  it('is playable before any location permission is requested', async () => {
    await begin();
    // The default mode is a hand-picked zone, so an encounter is already here.
    expect(mockGeo.getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pick a zone' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText(/everyone in this cell today/)).toBeInTheDocument();
  });

  it('changes the encounter when the zone changes', async () => {
    const user = await begin();
    const seedText = () =>
      screen.getByText(/^-?\d+:-?\d+@/).textContent as string;
    const first = seedText();
    await user.selectOptions(screen.getByLabelText('Zone'), 'lookout');
    await waitFor(() => expect(seedText()).not.toBe(first));
  });

  it('moves a cell at a time with no GPS at all', async () => {
    const user = await begin();
    await user.click(screen.getByRole('button', { name: 'Grid movement' }));
    const seedText = () =>
      screen.getByText(/^-?\d+:-?\d+@/).textContent as string;
    const before = seedText();
    // The North/West/East/South cross is now a 3x3 pad, so the tile names the
    // place it moves TO rather than just a compass word — the pad adds
    // diagonals and is narrower at 320px than the cross it replaced.
    await user.click(screen.getByRole('button', { name: /^Move north to/ }));
    await waitFor(() => expect(seedText()).not.toBe(before));
    expect(mockGeo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('says how far grid movement has taken you, and offers the way back', async () => {
    const user = await begin();
    await user.click(screen.getByRole('button', { name: 'Grid movement' }));
    const seedText = () =>
      screen.getByText(/^-?\d+:-?\d+@/).textContent as string;
    const home = seedText();

    await user.click(
      screen.getByRole('button', { name: /^Move north-east to/ })
    );
    const moved = await screen.findByRole('status', { name: 'Grid position' });
    expect(moved).toHaveTextContent(
      /100 m east and 100 m north of where you started — 141 m, north-east\./
    );

    await user.click(
      screen.getByRole('button', { name: 'Back to where I started' })
    );
    await waitFor(() => expect(seedText()).toBe(home));
    expect(
      screen.queryByRole('status', { name: 'Grid position' })
    ).not.toBeInTheDocument();
  });

  it('measures the offset from where you ANCHORED, never from the last step', async () => {
    // `step` moves the cell and never the origin. Re-anchoring on each step
    // would make the figure permanently zero and the sentence permanently a
    // lie — the whole point is that grid movement walks the map, not you.
    const user = await begin();
    await user.click(screen.getByRole('button', { name: 'Grid movement' }));
    await user.click(screen.getByRole('button', { name: /^Move north to/ }));
    await user.click(screen.getByRole('button', { name: /^Move north to/ }));
    expect(
      await screen.findByRole('status', { name: 'Grid position' })
    ).toHaveTextContent(/200 m north of where you started — 200 m, north\./);
  });

  it('asks for a fix only when the player picks GPS, and quantises it', async () => {
    const user = await begin();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(mockGeo.getCurrentPosition).toHaveBeenCalled();
    expect(
      await screen.findByText(/Waiting for a location/)
    ).toBeInTheDocument();
  });

  it('keeps playing when location is denied', async () => {
    mockGeo.error = { code: 1, message: 'denied' } as GeolocationPositionError;
    const user = await begin();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(
      await screen.findByText(/The game plays either way/)
    ).toBeInTheDocument();
    // The encounter is still on screen.
    expect(screen.getByText(/everyone in this cell today/)).toBeInTheDocument();
  });

  it('never prints the raw fix it was handed', async () => {
    mockGeo.position = {
      coords: {
        latitude: 35.045612345,
        longitude: -85.309787654,
        accuracy: 5,
      },
    } as GeolocationPosition;
    const user = await begin();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    await screen.findByText(/precise fix was discarded/);
    expect(document.body.textContent).not.toContain('35.045612');
    expect(document.body.textContent).not.toContain('-85.309787');
  });

  it('rolls a skill picked from the sheet and reports the outcome', async () => {
    const user = await begin();
    const sheet = screen
      .getByRole('heading', { name: 'Ada Wren', level: 2 })
      .closest('article') as HTMLElement;
    await user.click(within(sheet).getByRole('button', { name: /^Search/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Roll Search' })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/rolled/)
    );
  });

  it('deducts spent Character Points and remembers the spend', async () => {
    const user = await begin();
    const sheet = screen
      .getByRole('heading', { name: 'Ada Wren', level: 2 })
      .closest('article') as HTMLElement;
    expect(within(sheet).getByText('5')).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: /^Search/ }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Spend one more Character Point',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Roll Search' }));

    await waitFor(() => expect(loadCharacter()?.characterPoints).toBe(4));
  });

  it('replaces the character on request, keeping the name', async () => {
    const user = await begin('Ada Wren');
    const before = JSON.stringify(loadCharacter()?.attributes);
    let after = before;
    // Regenerate until the dice differ; identical draws are possible.
    for (let i = 0; i < 10 && after === before; i += 1) {
      // Two presses now: the first opens the guard, the second means it.
      await user.click(screen.getByRole('button', { name: 'New character' }));
      await user.click(
        screen.getByRole('button', { name: /Discard and roll a new one/ })
      );
      await waitFor(() => {
        after = JSON.stringify(loadCharacter()?.attributes);
      });
    }
    expect(after).not.toBe(before);
    expect(loadCharacter()?.name).toBe('Ada Wren');
  });

  it('exports the character as a file', async () => {
    const user = await begin();
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await user.click(screen.getByRole('button', { name: 'Export character' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });
});

describe('the roll is under the thumb that opened it', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGeo.position = null;
    mockGeo.error = null;
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
    render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    await user.type(screen.getByLabelText('Name'), 'Ada Wren');
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Ada Wren', level: 2 });
    return user;
  }

  it("opens the encounter's own suggestion, so the common case costs no taps", async () => {
    await begin();

    // Exactly one roll control exists, and exactly one row reports itself open.
    const rollButtons = screen.getAllByRole('button', { name: /^Roll / });
    expect(rollButtons).toHaveLength(1);

    const opened = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-expanded') === 'true');
    expect(opened).toHaveLength(1);

    // They are the same skill: the row that is open is the one being rolled.
    const skill = rollButtons[0].textContent!.replace(/^Roll\s+/, '').trim();
    expect(opened[0].textContent).toContain(skill);
  });

  it('moves the open row when a different skill is tapped', async () => {
    const user = await begin();
    const sheet = screen
      .getByRole('heading', { name: 'Ada Wren', level: 2 })
      .closest('article') as HTMLElement;

    await user.click(within(sheet).getByRole('button', { name: /^Lore/ }));

    const opened = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-expanded') === 'true');
    expect(opened).toHaveLength(1);
    expect(opened[0].textContent).toContain('Lore');
    expect(
      screen.getByRole('button', { name: 'Roll Lore' })
    ).toBeInTheDocument();
  });

  it('keeps the roll inside the sheet, not above it', async () => {
    await begin();
    const sheet = screen
      .getByRole('heading', { name: 'Ada Wren', level: 2 })
      .closest('article') as HTMLElement;
    const roll = screen.getAllByRole('button', { name: /^Roll / })[0];
    // The defect this replaces: the roller mounted inside EncounterCard, two
    // to three phone screens above the row the player actually touched.
    expect(sheet.contains(roll)).toBe(true);
  });
});

/**
 * The loop pays, and it pays once (#42).
 *
 * These use DETERMINISTIC DATES, verified against the engine rather than
 * guessed. The default zone is cell -77750:39012, and:
 *
 *   2026-08-26  cache  / Search   / heroic      reward 3, unreachable at 3d7
 *   2026-08-28  cache  / Scavenge / moderate    reward 1
 *   2026-09-08  shrine / Persuade / very-easy   reward 0, a win is near-certain
 *
 * The first of those is the playtester's actual session: they landed on the
 * 3%-weight Heroic band on their first visit, spent everything, and lost.
 */
describe('resolving a cell pays, once', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGeo.position = null;
    mockGeo.error = null;
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

  async function beginOn(date: string) {
    const user = userEvent.setup();
    render(<CharacterPlay today={new Date(`${date}T12:00:00Z`)} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    await user.type(screen.getByLabelText('Name'), 'Ada Wren');
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Ada Wren', level: 2 });
    return user;
  }

  it('pays nothing for a trivial cell, however well you roll', async () => {
    // 2026-09-08 is Very Easy: success is near-certain and the reward is 0 by
    // table. So this also proves a win is not automatically an income.
    const user = await beginOn('2026-09-08');
    await user.click(screen.getByRole('button', { name: /^Roll / }));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/rolled/)
    );
    expect(loadCharacter()?.characterPoints).toBe(5);
    expect(loadCharacter()?.earnedToday ?? 0).toBe(0);
  });

  it('does not pay twice for the same cell', async () => {
    const user = await beginOn('2026-08-28');
    const roll = screen.getByRole('button', { name: /^Roll / });
    await user.click(roll);
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/rolled/)
    );
    const afterFirst = loadCharacter()?.characterPoints ?? 0;

    // Resolution is fixed for this cell, so rolling again returns the same
    // faces. It must not pay again for them.
    await user.click(roll);
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/rolled/)
    );
    expect(loadCharacter()?.characterPoints).toBe(afterFirst);
  });

  it('never earns past the daily cap', async () => {
    const user = await beginOn('2026-08-28');
    await user.click(screen.getByRole('button', { name: /^Roll / }));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Roll result' })
      ).toHaveTextContent(/rolled/)
    );
    const c = loadCharacter();
    expect(c?.earnedToday ?? 0).toBeLessThanOrEqual(5);
    expect(c?.characterPoints ?? 0).toBeLessThanOrEqual(10);
  });

  it('remembers an outcome when you step away and back', async () => {
    // The old effect blanked `result` on every cell change, so returning to a
    // cell wiped what happened there — the loop had no memory.
    // Asserted on the ENCOUNTER outcome, not the roller's. The roller is keyed
    // by encounter seed, so stepping away remounts it and its internal state is
    // gone by design — the memory that matters lives in the hook and is what
    // survives the round trip.
    const user = await beginOn('2026-08-28');
    await user.click(screen.getByRole('button', { name: 'Grid movement' }));
    await user.click(screen.getByRole('button', { name: /^Roll / }));
    const outcome = () => screen.getByRole('status', { name: 'Roll result' });
    await waitFor(() => expect(outcome()).toHaveTextContent(/rolled/));
    const before = outcome().textContent;

    await user.click(screen.getByRole('button', { name: /^Move north to/ }));
    await user.click(screen.getByRole('button', { name: /^Move south to/ }));

    await waitFor(() => expect(outcome()).toHaveTextContent(/rolled/));
    expect(outcome().textContent).toBe(before);
  });
});
