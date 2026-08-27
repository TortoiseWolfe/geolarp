import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharacterSigil, { sigilCells, sigilSeed } from './CharacterSigil';
import {
  Character,
  generateCharacter,
  toExportJSON,
  fromExportJSON,
} from '@/lib/geolarp/character';

const base = (): Character => generateCharacter('Ada Wren');

describe('CharacterSigil', () => {
  it('is the same face for the same character', () => {
    const c = base();
    expect(sigilCells(c)).toEqual(sigilCells({ ...c }));
  });

  it('is BILATERALLY SYMMETRIC, which is what makes it read as a crest', () => {
    // Seeded noise without symmetry is static. Column 3 mirrors 1, 4 mirrors 0.
    const cells = sigilCells(base());
    expect(cells).toHaveLength(25);
    for (let row = 0; row < 5; row += 1) {
      expect(cells[row * 5 + 3]).toBe(cells[row * 5 + 1]);
      expect(cells[row * 5 + 4]).toBe(cells[row * 5 + 0]);
    }
  });

  it('is never blank and never solid', () => {
    // Both look like a rendering failure rather than a mark. Checked across a
    // wide sample because the bounded reroll is the only thing preventing it.
    for (let i = 0; i < 500; i += 1) {
      const c = generateCharacter(`Wanderer ${i}`);
      const filled = sigilCells(c).filter(Boolean).length;
      // The ACTUAL contract, 4..11 of 25 — not a loose 4..22 that would pass
      // with the bounded reroll deleted, which is what a first draft asserted.
      expect(filled).toBeGreaterThanOrEqual(4);
      expect(filled).toBeLessThanOrEqual(11);
    }
  });

  it('differs between characters', () => {
    const faces = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      faces.add(sigilCells(generateCharacter(`Wanderer ${i}`)).join(''));
    }
    // Distinct enough that two players do not routinely share a mark.
    expect(faces.size).toBeGreaterThan(150);
  });

  it('DOES NOT CHANGE WHEN THE CHARACTER DOES', () => {
    // Each exclusion is deliberate. `characterPoints` mutates every roll, so a
    // points-derived face would change mid-roll; attributes and skills would
    // drift the moment `advance()` is wired up.
    const c = base();
    const before = sigilCells(c).join('');
    const spent: Character = {
      ...c,
      characterPoints: 0,
      attributes: { ...c.attributes, Luck: { dice: 9, pips: 2 } },
      skills: { ...c.skills, Search: { dice: 9, pips: 0 } },
    };
    expect(sigilCells(spent).join('')).toBe(before);
  });

  it('survives an export round trip, and costs the export nothing', () => {
    // A pure function of the character, not a field on it: zero bytes stored,
    // `version` stays 1, and it looks the same on any device you import into.
    const c = base();
    const json = toExportJSON(c);
    expect(json).not.toContain('sigil');
    const back = fromExportJSON(json);
    expect(sigilCells(back)).toEqual(sigilCells(c));
    expect(sigilSeed(back)).toBe(sigilSeed(c));
  });

  it('takes its colour from theme roles only', () => {
    // No random character can generate a colour the theme has not already been
    // checked against — which is how a generated avatar otherwise fails
    // contrast for one character in forty and nobody finds out.
    const inks = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const { container, unmount } = render(
        <CharacterSigil character={generateCharacter(`W ${i}`)} decorative />
      );
      const cls = container.querySelector('svg')!.getAttribute('class') ?? '';
      const ink = /fill-(\w+)/.exec(cls)?.[0];
      expect(ink).toBeDefined();
      inks.add(ink!);
      unmount();
    }
    expect([...inks].sort()).toEqual([
      'fill-accent',
      'fill-primary',
      'fill-secondary',
    ]);
  });

  it('is hidden when decorative and named when it is not', () => {
    const c = base();
    const { unmount } = render(<CharacterSigil character={c} decorative />);
    expect(document.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    unmount();

    render(<CharacterSigil character={c} label="Ada Wren's sigil" />);
    expect(
      screen.getByRole('img', { name: "Ada Wren's sigil" })
    ).toBeInTheDocument();
  });
});
