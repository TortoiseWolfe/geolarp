import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CharacterSheet from './CharacterSheet';
import { generateCharacter } from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';

expect.extend(toHaveNoViolations);

const character = generateCharacter('Ada Wren', new Rng('a11y-fixture'));

describe('CharacterSheet Accessibility', () => {
  it('has no violations read-only', async () => {
    const { container } = render(<CharacterSheet character={character} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations fully interactive', async () => {
    const { container } = render(
      <CharacterSheet
        character={character}
        onRoll={vi.fn()}
        onExport={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('nests headings without skipping a level', () => {
    render(<CharacterSheet character={character} />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5);
  });

  it('labels each attribute section by its own heading', () => {
    const { container } = render(<CharacterSheet character={character} />);
    const sections = container.querySelectorAll('section');
    expect(sections).toHaveLength(5);
    sections.forEach((s) => {
      const id = s.getAttribute('aria-labelledby');
      expect(id).toBeTruthy();
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    });
  });

  it('gives every skill control a 44px touch target', () => {
    const { container } = render(
      <CharacterSheet character={character} onRoll={vi.fn()} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(15);
    buttons.forEach((b) => expect(b.className).toContain('min-h-11'));
  });

  it('keeps untrained skills at full contrast rather than dimming them', () => {
    // A dimmed row would be the obvious way to show "untrained" and would
    // fail the AAA floor; the distinction is carried by weight and by text
    // for a screen reader instead. `text-base-content/<n>` is banned repo-wide.
    const { container } = render(<CharacterSheet character={character} />);
    expect(container.innerHTML).not.toMatch(/text-base-content\/\d/);
    expect(container.innerHTML).not.toMatch(/opacity-\d/);
  });
});
