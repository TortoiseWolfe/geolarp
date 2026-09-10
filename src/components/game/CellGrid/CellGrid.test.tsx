import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CellGrid from './CellGrid';
import { Cell, flower, seedOf } from '@/lib/geolarp/cell';
import { encounterFor } from '@/lib/geolarp/encounter';
import { placeName } from '@/lib/geolarp/place';
import { LADDER } from '@/lib/geolarp/ladder';

const CENTRE: Cell = { q: -77750, r: 39012 };
const today = new Date('2026-08-26T12:00:00Z');

describe('CellGrid', () => {
  it('draws seven tiles, each NAMED even though the tile has no room to say so', () => {
    // 82px per tile at 320px holds a kind word and a pip row, and not a
    // two-word place name as well. The name is still the thing a player says
    // out loud, so it lives in the accessible name rather than nowhere.
    render(<CellGrid centre={CENTRE} today={today} />);
    for (const name of flower(CENTRE).map(placeName)) {
      expect(
        screen.getByLabelText(
          new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        )
      ).toBeInTheDocument();
    }
    expect(screen.queryByText(placeName(CENTRE))).not.toBeInTheDocument();
  });

  it('NEVER draws a dot on you — only the square', () => {
    // The privacy promise made visible. Every mapping UI puts a marker on the
    // user; this one cannot, because the raw fix never enters React state at
    // all. The centre tile says "where you are" and shows the same three facts
    // as every other tile — nothing positioned inside it.
    render(<CellGrid centre={CENTRE} today={today} />);
    const here = screen.getByLabelText(/where you are/);
    expect(here).toBeInTheDocument();
    // It is not a control: you cannot move to where you already are.
    expect(here.tagName).not.toBe('BUTTON');
    expect(document.body.textContent).not.toMatch(/\d+\.\d{4,}/);
  });

  it('is READ-ONLY without a step handler', () => {
    // Same contract as CharacterSheet's `onRoll`: a control that cannot act is
    // worse than no control.
    render(<CellGrid centre={CENTRE} today={today} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('offers SIX moves, named, and reports the direction it moved', async () => {
    const onStep = vi.fn();
    const user = userEvent.setup();
    render(<CellGrid centre={CENTRE} today={today} onStep={onStep} />);

    const buttons = screen.getAllByRole('button');
    // Seven tiles minus the one you are on. Six, not eight: a pointy-top hex has
    // flat sides east and west, so there is no due north or south to offer (#87).
    expect(buttons).toHaveLength(6);

    // The handler now takes a DIRECTION, not a delta. A delta only meant
    // something on a square lattice, where `x + dx` was a cell you could reach.
    await user.click(screen.getByLabelText(/^Move north-east to/));
    expect(onStep).toHaveBeenCalledWith('north-east');
    await user.click(screen.getByLabelText(/^Move south-west to/));
    expect(onStep).toHaveBeenLastCalledWith('south-west');

    // And the two that no longer exist.
    expect(screen.queryByLabelText(/^Move north to/)).toBeNull();
    expect(screen.queryByLabelText(/^Move south to/)).toBeNull();
  });

  it('is north-up: the top row is north of the bottom row', () => {
    // The bug this catches draws the world upside down and looks completely
    // fine until someone walks north.
    const onStep = vi.fn();
    render(<CellGrid centre={CENTRE} today={today} onStep={onStep} />);
    // Scoped past the wrapper: it is labelled "Move one cell", which a bare
    // /^Move / matches and puts at index 0, quietly shifting every position
    // this test is about.
    const labels = screen
      .getAllByLabelText(/where you are|^Move (north|south|east|west)/)
      .map((el) => el.getAttribute('aria-label') ?? '');
    // 2-3-2, north first: the centre is index 3, not 4, because the northern
    // row holds two tiles rather than three.
    expect(labels).toHaveLength(7);
    expect(labels[0]).toMatch(/^Move north-west/);
    expect(labels[1]).toMatch(/^Move north-east/);
    expect(labels[3]).toMatch(/where you are/);
    expect(labels[6]).toMatch(/^Move south-east/);
  });

  it('says the difficulty rather than only drawing it', () => {
    // The pips are a sighted affordance and they are COUNTED, not hued, so the
    // colourblind sweep passes by construction. The same fact has to reach a
    // screen reader as words, or the tile is decoration to anyone not counting
    // dots.
    render(<CellGrid centre={CENTRE} today={today} />);
    const enc = encounterFor(seedOf(CENTRE, today));
    const rank = LADDER.findIndex((b) => b.id === enc.difficulty) + 1;
    expect(
      screen.getByLabelText(
        new RegExp(`difficulty ${rank} of ${LADDER.length}`)
      )
    ).toBeInTheDocument();
  });

  it('names the group for what it can DO, not for what it looks like', () => {
    // `character-played.spec.ts` finds the movement controls by the exact
    // string "Move one cell". This pad replaced a North/West/East/South cross
    // and had to inherit that label — but only when it can actually move,
    // because a control name on something that is not a control is a lie a
    // screen reader repeats.
    const { rerender } = render(<CellGrid centre={CENTRE} today={today} />);
    expect(
      screen.getByRole('group', { name: 'The six cells around you' })
    ).toBeInTheDocument();

    rerender(<CellGrid centre={CENTRE} today={today} onStep={() => {}} />);
    expect(
      screen.getByRole('group', { name: 'Move one cell' })
    ).toBeInTheDocument();
  });
});

/**
 * "SEVEN TILES RENDERED" AND "SEVEN TILES OPERABLE" WERE THE SAME ASSERTION (#141).
 *
 * Both branches emitted the same `data-testid="cell-tile"` and the same `aria-label`, so
 * every selector in the suite counted seven tiles whether the grid was interactive or
 * inert. The dead-grid defect could be introduced, shipped and reverted with a fully green
 * suite each time — the shape CLAUDE.md warns about throughout: a gate is only as wide as
 * what it points at.
 */
describe('a gate can tell a live grid from a dead one (#141)', () => {
  const operable = () =>
    screen
      .getAllByTestId('cell-tile')
      .filter((t) => t.getAttribute('data-interactive') === 'true');

  it('renders seven tiles either way — which is why counting them proves nothing', () => {
    const { unmount } = render(<CellGrid centre={CENTRE} today={today} />);
    expect(screen.getAllByTestId('cell-tile')).toHaveLength(7);
    unmount();

    render(<CellGrid centre={CENTRE} today={today} onStep={vi.fn()} />);
    expect(screen.getAllByTestId('cell-tile')).toHaveLength(7);
  });

  it('marks the six moves operable only when a step handler exists', () => {
    const { unmount } = render(<CellGrid centre={CENTRE} today={today} />);
    expect(
      operable(),
      'tiles report themselves operable with no onStep — nothing can move'
    ).toHaveLength(0);
    unmount();

    render(<CellGrid centre={CENTRE} today={today} onStep={vi.fn()} />);
    // Six, not seven: the centre is where you already are.
    expect(operable()).toHaveLength(6);
    for (const tile of operable()) expect(tile.tagName).toBe('BUTTON');
  });

  /**
   * THE ACCESSIBILITY HALF (#139), and the worse one.
   *
   * A dead tile kept `aria-label="Move north-east to …"` on a `<div>` with no role: a
   * screen-reader user instructed to move by something that cannot be focused or
   * activated, and whose accessible name a bare `<div>` does not reliably expose at all.
   * The 7:1 AAA sweep and the colourblind gate both passed it, because neither asks
   * whether a control is operable.
   */
  it('never tells a screen reader to MOVE via something it cannot activate', () => {
    render(<CellGrid centre={CENTRE} today={today} />);
    for (const tile of screen.getAllByTestId('cell-tile')) {
      const label = tile.getAttribute('aria-label') ?? '';
      expect(
        label,
        `a non-interactive tile is labelled "${label}". The facts may stay; the ` +
          `instruction may not.`
      ).not.toMatch(/^Move /);
      // It must still SAY something — dropping the verb must not drop the place.
      expect(label.length).toBeGreaterThan(10);
    }
  });

  it('does say MOVE once the tile can actually be moved to', () => {
    // The control for the assertion above: if the verb never appeared, that test
    // would pass on a component that had lost its labels entirely.
    render(<CellGrid centre={CENTRE} today={today} onStep={vi.fn()} />);
    const moves = screen
      .getAllByTestId('cell-tile')
      .map((t) => t.getAttribute('aria-label') ?? '')
      .filter((l) => l.startsWith('Move '));
    expect(moves).toHaveLength(6);
  });

  /**
   * CHARACTERIZATION, NOT APPROVAL. `useCharacterPlay.ts` starts in `'zone'` mode, so
   * `CharacterPlay` passes no `onStep` and the player's primary control is inert on
   * arrival — #139. Whether that default is right is a product decision and this test does
   * not take it.
   *
   * It exists so the change is VISIBLE when it lands: fix #139 and this goes red, which is
   * the signal to update it rather than a bug.
   */
  it('DOCUMENTS the current default: no step handler means no operable tile (#139)', () => {
    render(<CellGrid centre={CENTRE} today={today} />);
    expect(
      operable(),
      'the grid is now operable without an explicit onStep. If #139 was fixed, update ' +
        'this test — it is a record of the old default, not a requirement.'
    ).toHaveLength(0);
  });
});
