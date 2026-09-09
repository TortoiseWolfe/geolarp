import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EncounterCard from './EncounterCard';
import { encounterFor } from '@/lib/geolarp/encounter';
import { bandOf } from '@/lib/geolarp/ladder';
import { cellCentre, cellOf, seedOf } from '@/lib/geolarp/cell';
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

  it('rates the cell without restating what the roller says', () => {
    render(<EncounterCard encounter={encounter} />);

    // The band NAMES the cell — a rating, and honest.
    expect(
      screen.getByText(bandOf(encounter.difficulty).label)
    ).toBeInTheDocument();

    // The card used to add "Roll Search. Needs 13 or more." beneath it, which
    // the roller already says next to the button that acts on it. Two copies
    // of an instruction are not twice as clear; they are one more thing to
    // read before the description, which is the only text here the player has
    // not already seen.
    expect(screen.queryByText(/Needs \d+ or more/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Roll /)).not.toBeInTheDocument();

    // And the range must never appear where it reads as the number to beat.
    // `roll()` succeeds on `total >= floor`, so a printed "(13-17)" told the
    // player 18 overshoots. It does not.
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
    expect(footer!.textContent).toContain(`${cell.q}:${cell.r}`);

    /*
     * ASSERT THE POSITIVE, NOT THE ABSENCE OF A STRING.
     *
     * This used to assert the raw fix's digits do not appear. That is a probe
     * that reports privacy by coincidence: the card prints to four decimals,
     * about 11 m, and a cell centre within 11 m of the fix that produced it
     * renders the SAME string. It happened on the hex lattice (#87) and the test
     * went red while the privacy property was perfectly intact — a false alarm
     * is a broken gate as surely as a false pass.
     *
     * So compare against what the card is SUPPOSED to show. This fails if the
     * component ever prints the fix, which is the actual defect, and it cannot
     * fail because two coarse numbers happened to round together.
     */
    const centre = cellCentre(cell);
    expect(footer!.textContent).toContain(
      `${centre.lat.toFixed(4)}, ${centre.lon.toFixed(4)}`
    );
    // And the centre must genuinely differ from the reading it came from.
    expect(centre.lat).not.toBe(35.0456);
    expect(centre.lon).not.toBe(-85.3097);
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
