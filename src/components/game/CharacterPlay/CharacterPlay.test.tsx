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
    await user.click(screen.getByRole('button', { name: 'North' }));
    await waitFor(() => expect(seedText()).not.toBe(before));
    expect(mockGeo.getCurrentPosition).not.toHaveBeenCalled();
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
        screen.getByRole('status', { name: 'Encounter outcome' })
      ).toHaveTextContent(/(You get past it|It holds)/)
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
