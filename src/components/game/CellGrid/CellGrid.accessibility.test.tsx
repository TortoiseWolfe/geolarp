import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CellGrid from './CellGrid';

expect.extend(toHaveNoViolations);

const centre = { q: -77750, r: 39012 };
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
    // SEVEN, not nine: the flower is 2-3-2 (#87). Not a lowered floor — the
    // number of tiles genuinely changed, and `flower` is asserted to return
    // exactly seven in tests/unit/cell-grid.test.ts.
    expect(pips).toHaveLength(7);
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
    //
    // `[data-testid]` rather than `.grid > *`. The old selector depended on a
    // LAYOUT class, so when the 3x3 CSS grid became three flex rows for the
    // 2-3-2 flower it silently matched zero elements — a coverage floor that
    // reported "0 of 9" instead of a real failure. A class-name selector has a
    // silent dependency on that class; a test hook does not.
    const tiles = container.querySelectorAll('[data-testid="cell-tile"]');
    expect(tiles).toHaveLength(7);
    tiles.forEach((t) => expect(t.className).toContain('min-h-11'));
  });
});
