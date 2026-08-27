import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EncounterCard from './EncounterCard';
import { encounterFor } from '@/lib/geolarp/encounter';
import { bandOf } from '@/lib/geolarp/ladder';
import { cellOf, seedOf } from '@/lib/geolarp/cell';
import { roll } from '@/lib/geolarp/dice';

const cell = cellOf(35.0456, -85.3097);
const seed = seedOf(cell, new Date('2026-08-26T12:00:00Z'));
const encounter = encounterFor(seed);

describe('EncounterCard', () => {
  it('shows the kind, the title and the description', () => {
    render(<EncounterCard encounter={encounter} />);
    expect(
      screen.getByRole('heading', { name: encounter.title, level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText(encounter.description)).toBeInTheDocument();
  });

  it('names the skill and states the target as a floor', () => {
    render(<EncounterCard encounter={encounter} />);
    expect(screen.getByText(encounter.skill)).toBeInTheDocument();

    // The band NAMES the cell — a rating, and honest.
    expect(
      screen.getByText(bandOf(encounter.difficulty).label)
    ).toBeInTheDocument();

    // But the range must not appear where it reads as the number to beat.
    // `roll()` succeeds on `total >= floor`, so a printed "(13-17)" told the
    // player 18 overshoots. It does not.
    expect(
      screen.getByText(
        new RegExp(`Needs ${bandOf(encounter.difficulty).floor} or more`)
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/\(\d+-\d+\)/)).not.toBeInTheDocument();
  });

  it('shows the seed, so two players can check they agree', () => {
    render(<EncounterCard encounter={encounter} cell={cell} />);
    expect(screen.getByText(seed)).toBeInTheDocument();
    expect(
      screen.getByText(/everyone in this cell today meets the same thing/)
    ).toBeInTheDocument();
  });

  it('shows the cell CENTRE, never a raw fix', () => {
    render(<EncounterCard encounter={encounter} cell={cell} />);
    const footer = screen.getByText(/Seeded from/).closest('footer');
    expect(footer!.textContent).toContain(`${cell.x}:${cell.y}`);
    // The fix that produced this cell was 35.0456,-85.3097. The card must not
    // print it — only the cell's own centre, which is coarser.
    expect(footer!.textContent).not.toContain('35.0456');
    expect(footer!.textContent).not.toContain('-85.3097');
  });

  it('omits the location line entirely when given no cell', () => {
    render(<EncounterCard encounter={encounter} />);
    expect(screen.queryByText(/^Cell /)).not.toBeInTheDocument();
    expect(screen.getByText(seed)).toBeInTheDocument();
  });

  /*
    The outcome tests that lived here are gone with the region they tested.
    `D7Roller` owns the single surviving live region and already covers the
    success, failure and wild-die sentences — duplicating them here would be
    two suites asserting one behaviour, which is how the duplicate region got
    written in the first place. Deleted whole rather than emptied: a passing
    `it()` with no assertion fails the #861 gate.
  */
  it('renders a roller passed as a child', () => {
    render(
      <EncounterCard encounter={encounter}>
        <button type="button">Roll it</button>
      </EncounterCard>
    );
    expect(screen.getByRole('button', { name: 'Roll it' })).toBeInTheDocument();
  });
});
