import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EncounterCard from './EncounterCard';
import { encounterFor } from '@/lib/geolarp/encounter';
import { cellOf, seedOf } from '@/lib/geolarp/cell';
import { roll } from '@/lib/geolarp/dice';
import { Rng } from '@/lib/geolarp/rng';

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

  it('names the skill to roll and the band to beat', () => {
    render(<EncounterCard encounter={encounter} />);
    expect(screen.getByText(encounter.skill)).toBeInTheDocument();
    // The band appears as a badge and in the instruction.
    expect(screen.getAllByText(/\(\d+(-\d+|\+)\)/).length).toBeGreaterThan(0);
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

  it('says nothing about an outcome before a roll', () => {
    render(<EncounterCard encounter={encounter} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reports a success', () => {
    const result = roll({ dice: 9, pips: 0 }, new Rng('win'), 2);
    render(<EncounterCard encounter={encounter} result={result} />);
    expect(screen.getByRole('status')).toHaveTextContent(/You get past it/);
  });

  it('reports a failure', () => {
    const result = roll({ dice: 1, pips: 0 }, new Rng('lose'), 99);
    render(<EncounterCard encounter={encounter} result={result} />);
    expect(screen.getByRole('status')).toHaveTextContent(/It holds/);
  });

  it('calls out a wild-die complication even on a success', () => {
    // Scan for a seed whose wild die shows 1 but whose total still clears a
    // low target — the case that makes the Wild Die interesting.
    let result = roll({ dice: 6, pips: 0 }, new Rng(0), 2);
    for (let s = 0; s < 500; s += 1) {
      const r = roll({ dice: 6, pips: 0 }, new Rng(s), 2);
      if (r.outcome === 'complication' && r.success) {
        result = r;
        break;
      }
    }
    expect(result.outcome).toBe('complication');
    expect(result.success).toBe(true);
    render(<EncounterCard encounter={encounter} result={result} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/You get past it/);
    expect(status).toHaveTextContent(/something goes wrong either way/);
  });

  it('renders a roller passed as a child', () => {
    render(
      <EncounterCard encounter={encounter}>
        <button type="button">Roll it</button>
      </EncounterCard>
    );
    expect(screen.getByRole('button', { name: 'Roll it' })).toBeInTheDocument();
  });
});
