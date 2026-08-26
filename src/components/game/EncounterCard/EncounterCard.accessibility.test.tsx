import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import EncounterCard from './EncounterCard';
import { encounterFor } from '@/lib/geolarp/encounter';
import { cellOf, seedOf } from '@/lib/geolarp/cell';
import { roll } from '@/lib/geolarp/dice';
import { Rng } from '@/lib/geolarp/rng';

expect.extend(toHaveNoViolations);

const cell = cellOf(35.0456, -85.3097);
const encounter = encounterFor(seedOf(cell, new Date('2026-08-26T12:00:00Z')));

describe('EncounterCard Accessibility', () => {
  it('has no violations before a roll', async () => {
    const { container } = render(
      <EncounterCard encounter={encounter} cell={cell} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with an outcome shown', async () => {
    const result = roll({ dice: 4, pips: 0 }, new Rng('a11y'), 13);
    const { container } = render(
      <EncounterCard encounter={encounter} cell={cell} result={result} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces the outcome in a named live region', () => {
    const result = roll({ dice: 4, pips: 0 }, new Rng('a11y'), 13);
    render(<EncounterCard encounter={encounter} result={result} />);
    const status = screen.getByRole('status', { name: 'Encounter outcome' });
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('labels the card by its title', () => {
    const { container } = render(<EncounterCard encounter={encounter} />);
    const article = container.querySelector('article');
    expect(article).toHaveAttribute('aria-labelledby', 'encounter-title');
    expect(container.querySelector('#encounter-title')).toHaveTextContent(
      encounter.title
    );
  });

  it('carries the kind in text, never in colour alone', () => {
    // A coloured badge with no words is invisible to a screen reader and to
    // anyone who cannot distinguish the hue.
    render(<EncounterCard encounter={encounter} />);
    const label = encounter.kind[0].toUpperCase() + encounter.kind.slice(1);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('uses no dimmed text', () => {
    const { container } = render(
      <EncounterCard encounter={encounter} cell={cell} />
    );
    expect(container.innerHTML).not.toMatch(/text-base-content\/\d/);
    expect(container.innerHTML).not.toMatch(/opacity-\d/);
  });
});
