import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coarseFixFrom, type CoarseFix } from '@/lib/geolarp/coarseFix';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CharacterPlay from './CharacterPlay';
import { STORAGE_KEY, loadCharacter } from '@/lib/geolarp/character';
import { cellOf } from '@/lib/geolarp/cell';
import { placeName } from '@/lib/geolarp/place';
import { ZONES } from './useCharacterPlay';

const today = new Date('2026-08-26T12:00:00Z');

const mockGeo = vi.hoisted(() => ({
  fix: null as CoarseFix | null,
  accuracy: null as number | null,
  error: null as GeolocationPositionError | null,
  getCurrentPosition: vi.fn(),
}));

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    ...mockGeo,
    permission: 'prompt',
    isSupported: true,
    clearWatch: vi.fn(),
    loading: false,
  }),
}));

describe('CharacterPlay', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGeo.fix = null;
    mockGeo.accuracy = null;
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

  async function begin(name = 'Ada Wren', day: Date = today) {
    const user = userEvent.setup();
    render(<CharacterPlay today={day} />);
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

  /**
   * THE SAFETY NOTICE MUST SURVIVE HAVING A CHARACTER (#89).
   *
   * The rules primer is a `<details>` that shuts for a returning player — see the
   * test directly below, which asserts exactly that. Copy telling someone to watch
   * for traffic cannot live there: after the first session nobody would ever see
   * it again. This asserts the notice is present in BOTH states and outside any
   * disclosure, which is the property that makes it durable rather than decorative.
   */
  it('keeps the safety notice visible after the rules have shut', async () => {
    const user = userEvent.setup();
    render(<CharacterPlay today={today} />);

    // New player: rules open, notice present.
    const first = await screen.findByTestId('play-safety');
    expect(first).toBeInTheDocument();
    expect(
      first.closest('details'),
      'the notice is inside a disclosure, so a returning player never sees it'
    ).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Wanderer', level: 2 });

    // Returning player: rules shut, notice STILL present. This is the assertion
    // the ticket is actually about.
    const after = screen.getByTestId('play-safety');
    expect(
      screen.getByText('How geoLARP works').closest('details')
    ).toHaveProperty('open', false);
    expect(after).toBeInTheDocument();
    expect(after.closest('details')).toBeNull();

    // The three things it has to say, by substance rather than by exact wording,
    // so a copy edit does not fail this but a deletion does.
    expect(after.textContent).toMatch(/traffic/i);
    expect(after.textContent).toMatch(/private property/i);
    expect(after.textContent).toMatch(/13 and over/i);
    // And the route to the binding version of all of it.
    expect(
      within(after).getByRole('link', { name: /terms/i })
    ).toBeInTheDocument();
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

  it('names the place you are in exactly ONCE on screen', async () => {
    // Found in a screenshot, not by a test — which is why there is now a test.
    // "Where you are" promotes the place name into its summary, and the
    // encounter footer had been given the same name, so "Cold Rampart" was
    // printed twice on one phone screen in two collapsed summaries. That
    // landed one commit after the pass whose entire job was deleting
    // duplicated text.
    //
    // The grid's aria-labels name every cell and are not counted: naming a
    // control for a screen reader is a different modality from printing the
    // same two words twice for a sighted reader.
    await begin();
    const here = cellOf(ZONES[1].lat, ZONES[1].lon);
    expect(screen.getAllByText(placeName(here))).toHaveLength(1);
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
    await user.click(
      screen.getByRole('button', { name: /^Move north-east to/ })
    );
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
    /*
     * 76 EAST, NOT 50, AND THAT IS THE SHEAR SHOWING ITS FACE.
     *
     * An ideal north-east step is 50 m east and 86.6 m north — exactly 100 m.
     * This fixture sits at Chattanooga, where rows quantise longitude slightly
     * differently, so the step measures 76 east and lands at 115 m. Asserting a
     * clean 100 here would be asserting an unsheared lattice this app does not
     * have (#87 records the whole envelope: 1.282 max/min at this latitude).
     *
     * It is still better than what it replaced. The same one step on the square
     * grid read "100 m east and 100 m north — 141 m": one step, 41% further
     * walked for the same reward, everywhere, by construction.
     */
    expect(moved).toHaveTextContent(
      /76 m east and 87 m north of where you started — 115 m, north-east\./
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
    await user.click(
      screen.getByRole('button', { name: /^Move north-east to/ })
    );
    await user.click(
      screen.getByRole('button', { name: /^Move north-east to/ })
    );
    expect(
      await screen.findByRole('status', { name: 'Grid position' })
      // Two north-east steps from the same anchor: the east components accumulate
      // (76 + 76) and so do the rows (87 + 87). The point of the assertion is that
      // it measures from the ANCHOR and not from the last step, which is why both
      // components are doubled rather than reset.
    ).toHaveTextContent(
      /15[0-9] m east and 17[0-9] m north of where you started — 2[0-9][0-9] m, north-east\./
    );
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

  /**
   * THROUGH THE REAL QUANTISER, NOT A HAND-ROUNDED MOCK (#39).
   *
   * The hook no longer returns a raw position at all, so a mock supplying one
   * would not compile and a mock supplying an already-rounded `fix` could not
   * fail — the raw digits would be absent because the test author removed them,
   * which proves nothing.
   *
   * So the raw reading goes through `coarseFixFrom`, the real function on the real
   * path. If it ever stops rounding, the raw digits reach the DOM and this fails.
   * The component-level claim and the library-level claim are then the same claim.
   */
  it('never prints the raw fix it was handed', async () => {
    mockGeo.fix = coarseFixFrom({
      coords: {
        latitude: 35.045612345,
        longitude: -85.309787654,
        accuracy: 5,
      },
      timestamp: 1_757_000_000_000,
    } as GeolocationPosition);
    mockGeo.accuracy = 5;
    const user = await begin();
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    await screen.findByText(/precise fix was discarded/);
    // The shipped sentence at CharacterPlay.tsx:310 says the precise fix was
    // discarded. Until #39 that sentence was false. These two lines are what
    // make it true, and `page.content()`-style markup coverage is why the
    // assertion reads the whole body rather than a single node.
    expect(document.body.innerHTML).not.toContain('35.045612');
    expect(document.body.innerHTML).not.toContain('-85.309787');
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
    /*
     * ITS OWN DAY, AND A ZERO-PAY ONE ON PURPOSE.
     *
     * This asserts that SPENDING deducts. On the shared fixture day the cell's
     * encounter now pays 1 on success, so spend-one-earn-one nets to zero and the
     * test passed 5 where it wanted 4 — measuring nothing while looking green.
     * (The hex conversion moved every cell key, so which encounter sits here
     * changed; the trap was always there and #87 merely walked into it.)
     *
     * 2026-08-07 puts an `easy` encounter on this cell, and `REWARD_BY_BAND` pays
     * 0 for very-easy and easy — 35% of the world. So the only movement in the
     * total is the spend, which is the thing under test.
     */
    const user = await begin('Ada Wren', new Date('2026-08-07T12:00:00Z'));
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
    mockGeo.fix = null;
    mockGeo.accuracy = null;
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

  /**
   * THE SUGGESTION IS ADVICE, AND ADVICE DOES NOT CLAIM THE PAYOUT (#63).
   *
   * This test used to assert the opposite — "opens the encounter's own
   * suggestion, so the common case costs no taps" — and it was green the whole
   * time the product's own copy said "a cell suggests a skill, but anything you
   * can argue for is fair". A cell pays ONCE, so the row that is open when the
   * player arrives collects the only reward that cell will ever give.
   *
   * The cost was concentrated: `PROFILES` only ever suggests nine of the twenty
   * skills, so pre-opening one made the other eleven — `Navigate` and `Sprint`
   * among them, in a walking game — fully rollable and never the default claim.
   */
  it('opens nothing on arrival, so the payout is not claimed by default', async () => {
    await begin();

    // No roll control at all: there is nothing selected to roll.
    expect(screen.queryAllByRole('button', { name: /^Roll / })).toHaveLength(0);

    const opened = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-expanded') === 'true');
    expect(
      opened.map((b) => b.textContent),
      'a row is open before the player chose one, which is the pre-selection ' +
        "coming back: whichever row that is collects the cell's only payout"
    ).toEqual([]);
  });

  /**
   * Removing the pre-selection must not make TAKING the advice expensive. The
   * `Go to {skill}` control on the encounter card is the whole compensation: one
   * tap, on the card the player is already reading, and now a choice they made.
   */
  it('takes the advice in one tap, when the player asks for it', async () => {
    const user = await begin();
    const goTo = screen.getByRole('button', { name: /^Go to / });
    const suggested = goTo.textContent!.replace(/^Go to\s+/, '').trim();

    await user.click(goTo);

    const opened = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-expanded') === 'true');
    expect(opened).toHaveLength(1);
    expect(opened[0].textContent).toContain(suggested);
    expect(
      screen.getByRole('button', { name: `Roll ${suggested}` })
    ).toBeInTheDocument();
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
    const user = await begin();
    await user.click(screen.getByRole('button', { name: /^Go to / }));
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
    mockGeo.fix = null;
    mockGeo.accuracy = null;
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
    // TAKE THE ADVICE, deliberately and by hand.
    //
    // Nothing is selected on arrival since #63, so there is no roll control
    // until the player picks — and these cases are about the PAYOUT, which is
    // per cell and indifferent to the skill. Clicking through the card's own
    // `Go to` reproduces exactly what the removed pre-selection used to do, so
    // the dates and rewards documented above still describe what runs here.
    await user.click(screen.getByRole('button', { name: /^Go to / }));
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

    // NE then SW, not north then south. A pointy-top hex has no due north (#87),
    // and these two must be RECIPROCAL or the player does not return to the cell
    // whose outcome is being remembered — which is the whole subject here.
    await user.click(
      screen.getByRole('button', { name: /^Move north-east to/ })
    );
    await user.click(
      screen.getByRole('button', { name: /^Move south-west to/ })
    );

    await waitFor(() => expect(outcome()).toHaveTextContent(/rolled/));
    expect(outcome().textContent).toBe(before);
  });

  /**
   * THE SAME MEMORY, FOR A SKILL THE CELL DID NOT SUGGEST (#63).
   *
   * The test above cannot see this: it rolls the suggestion, so a lookup keyed
   * on `encounter.skill` and a lookup keyed on what the player rolled give the
   * same answer. They were the same thing only while the selection WAS the
   * suggestion. The moment the pre-selection came out they could disagree, and
   * a suggestion-keyed lookup silently forgot every outcome earned any other
   * way — which is most of them, since the point of #63 is that all twenty
   * skills are now live and only nine are ever suggested.
   *
   * 2026-08-28 suggests `Scavenge`; this rolls `Lore` on purpose.
   */
  it('remembers a skill the cell never suggested', async () => {
    const user = await beginOn('2026-08-28');
    const sheet = screen
      .getByRole('heading', { name: 'Ada Wren', level: 2 })
      .closest('article') as HTMLElement;

    const suggested = screen
      .getByRole('button', { name: /^Go to / })
      .textContent!.replace(/^Go to\s+/, '')
      .trim();
    expect(suggested).not.toBe('Lore');

    await user.click(within(sheet).getByRole('button', { name: /^Lore/ }));
    await user.click(screen.getByRole('button', { name: 'Roll Lore' }));
    const outcome = () => screen.getByRole('status', { name: 'Roll result' });
    await waitFor(() => expect(outcome()).toHaveTextContent(/rolled/));
    const before = outcome().textContent;

    await user.click(screen.getByRole('button', { name: 'Grid movement' }));
    await user.click(
      screen.getByRole('button', { name: /^Move north-east to/ })
    );
    await user.click(
      screen.getByRole('button', { name: /^Move south-west to/ })
    );

    await waitFor(() => expect(outcome()).toHaveTextContent(/rolled/));
    expect(outcome().textContent).toBe(before);
    // And the row that comes back open is the one that was rolled, not the one
    // the cell suggests. Reopening it claims nothing — the cell is already paid.
    const opened = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-expanded') === 'true');
    expect(opened).toHaveLength(1);
    expect(opened[0].textContent).toContain('Lore');
  });
});

/**
 * AN ARMCHAIR OFFSET MUST NOT SURVIVE A MODE CHANGE (#150).
 *
 * The distance readout is gated on `play.offset` (CharacterPlay.tsx:373); the sentence
 * that explains it — "Grid movement walks the map, not you" — is gated on the MODE
 * (:402). Nothing cleared the offset when the mode changed, so after a switch only the
 * honest half disappeared, and the app told a player who had not moved that they were
 * 115 m from where they started.
 *
 * The comment above that sentence names this exact state as the thing it exists to
 * prevent: "the alternative is a player believing the game thinks they walked
 * somewhere."
 *
 * WORSE THAN #140, NOT THE SAME. #140 is silence — a real walk produces no feedback.
 * This is a false signal, aimed at precisely the player the honesty line was written
 * for.
 */
describe('the offset never outlives the mode that produced it (#150)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGeo.fix = null;
    mockGeo.accuracy = null;
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

  async function beginAndStep() {
    const user = userEvent.setup();
    render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    await user.type(screen.getByLabelText('Name'), 'Ada Wren');
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Ada Wren', level: 2 });
    await user.click(screen.getByRole('button', { name: 'Grid movement' }));
    await user.click(
      screen.getByRole('button', { name: /^Move north-east to/ })
    );
    return user;
  }

  const readout = () => screen.queryByRole('status', { name: 'Grid position' });

  it('shows the distance AND the disclaimer while still in grid mode', () => {
    // The control. Without it, a fix that simply deleted the readout would satisfy
    // the assertion below while removing the feature.
    return beginAndStep().then(() => {
      expect(readout()).toBeInTheDocument();
      expect(
        screen.getByText(/Grid movement walks the map, not you/)
      ).toBeInTheDocument();
    });
  });

  it('drops the armchair distance when the player switches to GPS', async () => {
    const user = await beginAndStep();
    expect(
      readout(),
      'the step produced no offset; the test proves nothing'
    ).toBeInTheDocument();

    // Deny the fix, which is the persistent case: both effects early-return while
    // `geo.fix` is null, so nothing else can clear the stale value.
    await user.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(
      screen.queryByText(/Grid movement walks the map, not you/),
      'the disclaimer is gated on mode and is expected to go'
    ).not.toBeInTheDocument();

    expect(
      readout(),
      'the grid-derived distance is still on screen in GPS mode, with the sentence ' +
        'that explains it now gone — the app is telling a stationary player they walked'
    ).not.toBeInTheDocument();
  });

  it('drops it when switching to zone mode too, not just GPS', async () => {
    const user = await beginAndStep();
    expect(readout()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pick a zone' }));
    expect(
      readout(),
      'the offset leaked into zone mode; the gate must be the mode change, not GPS'
    ).not.toBeInTheDocument();
  });
});

/**
 * THE PLAYER WHO ACTUALLY WALKS GETS FEEDBACK TOO (#140).
 *
 * `setCellFromFix` anchored `origin` on every fix, so `cell` and `origin` were set to
 * the same value in the same breath and `offset` was permanently null under GPS. The
 * distance readout is gated on `offset`, so the mode the published promise is about —
 * "a game that only works if you move" — was the one with no instrumentation, while
 * grid movement, which the hook's own comment calls armchair movement, had all of it.
 *
 * The second test here guards the lie the fix could have introduced. `setMode` anchors
 * to the CURRENT cell on every mode change (#150). Deferring the GPS anchor naively
 * would leave `origin` on whatever zone the player was browsing, so picking Downtown
 * Chattanooga and then walking outside in London would have announced several thousand
 * kilometres "from where you started" — #150's defect wearing #140's clothes.
 *
 * Together they fail in both directions: anchor on every fix and the first fails;
 * never anchor and the second fails.
 */
describe('the walking player is instrumented too (#140)', () => {
  const CHATTANOOGA = { latitude: 35.0456, longitude: -85.3097 };
  // ~333 m north: 0.003 degrees of latitude, several 100 m cells.
  const THREE_HUNDRED_M_NORTH = { latitude: 35.0486, longitude: -85.3097 };
  const LONDON = { latitude: 51.5042, longitude: -0.0905 };

  const fixAt = (c: { latitude: number; longitude: number }) =>
    coarseFixFrom({
      coords: { ...c, accuracy: 5 },
      timestamp: 1_757_000_000_000,
    } as GeolocationPosition);

  beforeEach(() => {
    window.localStorage.clear();
    mockGeo.fix = null;
    mockGeo.accuracy = null;
    mockGeo.error = null;
  });

  const readout = () => screen.queryByRole('status', { name: 'Grid position' });

  async function beginOnGps(at: { latitude: number; longitude: number }) {
    mockGeo.fix = fixAt(at);
    mockGeo.accuracy = 5;
    const user = userEvent.setup();
    const view = render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    await user.type(screen.getByLabelText('Name'), 'Ada Wren');
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Ada Wren', level: 2 });
    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    return { user, view };
  }

  it('says nothing until the player has moved, then reports the distance', async () => {
    const { view } = await beginOnGps(CHATTANOOGA);

    // The control: standing still is not "somewhere else". Without this a fix that
    // simply always rendered the readout would satisfy the assertion below.
    expect(
      readout(),
      'a player who has not moved was told they had'
    ).not.toBeInTheDocument();

    mockGeo.fix = fixAt(THREE_HUNDRED_M_NORTH);
    view.rerender(<CharacterPlay today={today} />);

    const moved = await screen.findByRole('status', { name: 'Grid position' });
    expect(moved).toHaveTextContent(/of where you started/);
    expect(moved).toHaveTextContent(/north/);
  });

  it('anchors on the first fix, not on the zone the player was browsing', async () => {
    const user = userEvent.setup();
    const view = render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    await user.type(screen.getByLabelText('Name'), 'Ada Wren');
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Ada Wren', level: 2 });

    // Default mode is a hand-picked Chattanooga zone. Go outside somewhere else.
    mockGeo.fix = fixAt(LONDON);
    mockGeo.accuracy = 5;
    await user.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(
      readout(),
      'the zone-to-fix distance leaked: the player was told they walked from a place ' +
        'they only browsed'
    ).not.toBeInTheDocument();

    // And the anchor is live rather than merely absent — walking still registers.
    mockGeo.fix = fixAt({ latitude: 51.5072, longitude: -0.0905 });
    view.rerender(<CharacterPlay today={today} />);
    expect(
      await screen.findByRole('status', { name: 'Grid position' })
    ).toHaveTextContent(/of where you started/);
  });

  it('offers no "Back to where I started" on foot, because the next fix would undo it', async () => {
    const { view } = await beginOnGps(CHATTANOOGA);
    mockGeo.fix = fixAt(THREE_HUNDRED_M_NORTH);
    view.rerender(<CharacterPlay today={today} />);
    await screen.findByRole('status', { name: 'Grid position' });

    expect(
      screen.queryByRole('button', { name: 'Back to where I started' }),
      'a walking player was offered a button the next fix overwrites'
    ).not.toBeInTheDocument();
  });
});

/**
 * THE SWITCH THAT ARMS THE GRID IS NOW NEXT TO THE GRID (#139).
 *
 * The mode buttons live inside the collapsed "Where you are" disclosure while the grid
 * deliberately sits outside it, so the control was on screen and the thing that makes it
 * work was not. A player tapped a tile, nothing happened, and nothing distinguished
 * "broken" from "not switched on yet".
 *
 * Zone only. Under GPS the tiles are inert because the player moves by walking — the
 * published promise — so offering armchair stepping there would undercut it.
 */
describe('there is a visible way to turn stepping on (#139)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGeo.fix = null;
    mockGeo.accuracy = null;
    mockGeo.error = null;
  });

  async function begunWithCharacter() {
    const user = userEvent.setup();
    render(<CharacterPlay today={today} />);
    await screen.findByRole('button', { name: 'Roll a character' });
    await user.type(screen.getByLabelText('Name'), 'Ada Wren');
    await user.click(screen.getByRole('button', { name: 'Roll a character' }));
    await screen.findByRole('heading', { name: 'Ada Wren', level: 2 });
    return user;
  }

  const stepper = () => screen.queryByRole('button', { name: 'Step the grid' });
  const operable = () =>
    screen
      .getAllByTestId('cell-tile')
      .filter((t) => t.getAttribute('data-interactive') === 'true');

  it('offers it in the default mode, where the tiles are inert', async () => {
    await begunWithCharacter();
    expect(
      operable(),
      'the tiles were already live; this test proves nothing'
    ).toHaveLength(0);
    expect(stepper()).toBeInTheDocument();
  });

  it('actually makes the tiles operable, without opening the disclosure', async () => {
    const user = await begunWithCharacter();
    await user.click(stepper()!);
    expect(operable().length).toBeGreaterThan(0);
    // And it takes itself away once it has done its job.
    expect(stepper()).not.toBeInTheDocument();
  });

  it('stays out of GPS mode, where inert tiles are the promise being kept', async () => {
    const user = await begunWithCharacter();
    // The control. Asserting only the absence passes on a build where the button
    // was never added at all, which is how three of these first shipped.
    expect(
      stepper(),
      'the offer is missing in zone mode, so its absence under GPS proves nothing'
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    expect(
      stepper(),
      'a walking player was invited to move the map instead of themselves'
    ).not.toBeInTheDocument();
  });
});
