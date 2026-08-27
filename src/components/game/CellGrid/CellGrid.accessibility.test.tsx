import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CellGrid from './CellGrid';

expect.extend(toHaveNoViolations);

const centre = { x: -77750, y: 39012 };
const today = new Date('2026-08-26T12:00:00Z');

describe('CellGrid accessibility', () => {
  it('has no violations when read-only', async () => {
    const { container } = render(<CellGrid centre={centre} today={today} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when walkable', async () => {
    const { container } = render(
      <CellGrid centre={centre} today={today} onStep={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('gives the pips no colour of their own, so the measured text proves them', () => {
    // The pip row is `aria-hidden`, which means axe never measures it — and an
    // aria-hidden element with VISIBLE text that fails contrast is a real AAA
    // failure that no sweep on this repo would report. It carries no colour
    // class, so it inherits the tile's, and the tile's kind word IS measured
    // by `character-played.spec.ts` at the same 7:1 threshold (0.65rem and
    // text-xs are both "normal" text, and font-semibold is 600, not bold).
    //
    // Verifying where the check can see, for the thing the check cannot.
    const { container } = render(<CellGrid centre={centre} today={today} />);
    const pips = container.querySelectorAll('[aria-hidden="true"]');
    expect(pips).toHaveLength(9);
    pips.forEach((pip) => {
      expect(pip.className).not.toMatch(
        /\btext-(primary|secondary|accent|base|neutral|info|success|warning|error)/
      );
    });
  });

  it('gives every tile a 44px touch target', () => {
    const { container } = render(
      <CellGrid centre={centre} today={today} onStep={() => {}} />
    );
    // The TILES, not the wrapper — which is also `[aria-label]`, is not a
    // touch target, and would have made this assertion fail for a reason that
    // has nothing to do with tile size.
    const tiles = container.querySelectorAll('.grid > *');
    expect(tiles).toHaveLength(9);
    tiles.forEach((t) => expect(t.className).toContain('min-h-11'));
  });
});
