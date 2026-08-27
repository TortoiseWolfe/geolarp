import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CharacterSheet from './CharacterSheet';
import { generateCharacter, SKILLS, SkillName } from '@/lib/geolarp/character';
import { formatCode } from '@/lib/geolarp/dice';
import { Rng } from '@/lib/geolarp/rng';

const character = generateCharacter('Ada Wren', new Rng('sheet-fixture'));

describe('CharacterSheet', () => {
  it('names the character and shows Character Points', () => {
    render(<CharacterSheet character={character} />);
    expect(
      screen.getByRole('heading', { name: 'Ada Wren', level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(String(character.characterPoints))
    ).toBeInTheDocument();
  });

  it('shows every attribute as a dice code, never a bare number', () => {
    render(<CharacterSheet character={character} />);
    for (const attr of [
      'Strength',
      'Agility',
      'Intellect',
      'Spirit',
      'Luck',
    ] as const) {
      const heading = screen.getByRole('heading', { name: new RegExp(attr) });
      expect(heading).toHaveTextContent(formatCode(character.attributes[attr]));
      expect(heading.textContent).toMatch(/\dd7(\+[12])?/);
    }
  });

  it('lists every skill under the attribute that governs it', () => {
    render(<CharacterSheet character={character} />);
    for (const skill of Object.keys(SKILLS) as SkillName[]) {
      const section = screen
        .getByRole('heading', { name: new RegExp(SKILLS[skill]) })
        .closest('section');
      expect(section).not.toBeNull();
      expect(section!.textContent).toContain(skill);
    }
  });

  it('shows an untrained skill at its attribute rather than blank', () => {
    render(<CharacterSheet character={character} />);
    const untrained = (Object.keys(SKILLS) as SkillName[]).filter(
      (s) => character.skills[s] === undefined
    );
    expect(untrained.length).toBeGreaterThan(0);
    for (const skill of untrained) {
      const attrCode = formatCode(character.attributes[SKILLS[skill]]);
      const row = screen.getByText(skill).closest('p, button');
      expect(row).not.toBeNull();
      expect(row!.textContent).toContain(attrCode);
      expect(row!.textContent).toContain('untrained');
    }
  });

  it('marks a trained skill as trained for a screen reader', () => {
    render(<CharacterSheet character={character} />);
    const trained = (Object.keys(SKILLS) as SkillName[]).filter(
      (s) => character.skills[s] !== undefined
    );
    expect(trained.length).toBeGreaterThan(0);
    const row = screen.getByText(trained[0]).closest('p, button');
    expect(row!.textContent).toContain('(trained)');
  });

  it('is read-only when no onRoll is given', () => {
    render(<CharacterSheet character={character} />);
    // No skill buttons; the action row is absent entirely.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('rolls the skill that was pressed', async () => {
    const user = userEvent.setup();
    const onRoll = vi.fn();
    render(<CharacterSheet character={character} onRoll={onRoll} />);
    await user.click(screen.getByRole('button', { name: /^Search/ }));
    expect(onRoll).toHaveBeenCalledWith('Search');
  });

  it('exports and regenerates only when asked to', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onRegenerate = vi.fn();
    render(
      <CharacterSheet
        character={character}
        onExport={onExport}
        onRegenerate={onRegenerate}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Export character' }));
    await user.click(screen.getByRole('button', { name: 'New character' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('warns that the character is browser-local, on the sheet itself', () => {
    render(<CharacterSheet character={character} />);
    // The published promise makes the player responsible for the export, so
    // the warning has to be where they will see it.
    expect(
      screen.getByText(/Clearing your browser data deletes it/)
    ).toBeInTheDocument();
  });

  it('re-renders when the character changes', () => {
    const { rerender } = render(<CharacterSheet character={character} />);
    const other = generateCharacter('Bram Holt', new Rng('other'));
    rerender(<CharacterSheet character={other} />);
    expect(
      screen.getByRole('heading', { name: 'Bram Holt', level: 2 })
    ).toBeInTheDocument();
    expect(screen.queryByText('Ada Wren')).not.toBeInTheDocument();
  });
});
