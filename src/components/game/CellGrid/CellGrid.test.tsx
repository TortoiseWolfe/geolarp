import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CellGrid from './CellGrid';
import { Cell, grid3x3, seedOf } from '@/lib/geolarp/cell';
import { encounterFor } from '@/lib/geolarp/encounter';
import { placeName } from '@/lib/geolarp/place';
import { LADDER } from '@/lib/geolarp/ladder';

const CENTRE: Cell = { x: -77750, y: 39012 };
const today = new Date('2026-08-26T12:00:00Z');

describe('CellGrid', () => {
  it('draws nine cells, each NAMED even though the tile has no room to say so', () => {
    // 82px per tile at 320px holds a kind word and a pip row, and not a
    // two-word place name as well. The name is still the thing a player says
    // out loud, so it lives in the accessible name rather than nowhere.
    render(<CellGrid centre={CENTRE} today={today} />);
    for (const name of grid3x3(CENTRE).map(placeName)) {
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

  it('offers eight moves, and reports the direction it moved', async () => {
    const onStep = vi.fn();
    const user = userEvent.setup();
    render(<CellGrid centre={CENTRE} today={today} onStep={onStep} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(8); // nine tiles, minus the one you are on

    await user.click(screen.getByLabelText(/^Move north to/));
    expect(onStep).toHaveBeenCalledWith(0, 1);
    await user.click(screen.getByLabelText(/^Move south-west to/));
    expect(onStep).toHaveBeenLastCalledWith(-1, -1);
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
    expect(labels[0]).toMatch(/^Move north-west/);
    expect(labels[4]).toMatch(/where you are/);
    expect(labels[8]).toMatch(/^Move south-east/);
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
      screen.getByRole('group', { name: 'The nine cells around you' })
    ).toBeInTheDocument();

    rerender(<CellGrid centre={CENTRE} today={today} onStep={() => {}} />);
    expect(
      screen.getByRole('group', { name: 'Move one cell' })
    ).toBeInTheDocument();
  });
});
