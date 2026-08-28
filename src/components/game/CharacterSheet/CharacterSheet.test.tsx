import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    expect(onExport).toHaveBeenCalledTimes(1);

    // "New character" is destructive, so it now opens a confirm rather than
    // firing. The guarded path is covered in its own describe below.
    await user.click(screen.getByRole('button', { name: 'New character' }));
    expect(onRegenerate).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: /Discard and roll a new one/ })
    );
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

describe('the roll lives in the row you touched', () => {
  const skill = 'Search' as SkillName;

  it('renders nothing extra when no row is expanded', () => {
    render(
      <CharacterSheet
        character={character}
        onRoll={vi.fn()}
        renderExpanded={() => <p>the roller</p>}
      />
    );
    expect(screen.queryByText('the roller')).not.toBeInTheDocument();
  });

  it('puts the panel INSIDE the row, not elsewhere on the sheet', () => {
    render(
      <CharacterSheet
        character={character}
        onRoll={vi.fn()}
        expandedSkill={skill}
        renderExpanded={(s) => <p>rolling {s}</p>}
      />
    );
    const panel = screen.getByText(/rolling Search/);
    const row = screen.getByRole('button', { name: /^Search/ }).closest('li');
    expect(row).not.toBeNull();
    // Containment is the whole point: the old layout put this two to three
    // phone screens above the tapped row.
    expect(row!.contains(panel)).toBe(true);
  });

  it('marks the open row as expanded and points it at its panel', () => {
    render(
      <CharacterSheet
        character={character}
        onRoll={vi.fn()}
        expandedSkill={skill}
        renderExpanded={() => <p>the roller</p>}
      />
    );
    const button = screen.getByRole('button', { name: /^Search/ });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const id = button.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toContainElement(
      screen.getByText('the roller')
    );
  });

  it('opens exactly one row at a time', () => {
    render(
      <CharacterSheet
        character={character}
        onRoll={vi.fn()}
        expandedSkill={skill}
        renderExpanded={() => <p>the roller</p>}
      />
    );
    expect(screen.getAllByText('the roller')).toHaveLength(1);
    const expanded = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-expanded') === 'true');
    expect(expanded).toHaveLength(1);
  });

  it('stays read-only when there is no onRoll, panel or not', () => {
    render(
      <CharacterSheet
        character={character}
        expandedSkill={skill}
        renderExpanded={() => <p>the roller</p>}
      />
    );
    // The embed mode /profile could use: zero buttons, and no roll surface.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('the roller')).not.toBeInTheDocument();
  });
});

describe('replacing a character is guarded (#42)', () => {
  it('does not destroy anything on the first press', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    render(
      <CharacterSheet character={character} onRegenerate={onRegenerate} />
    );
    await user.click(screen.getByRole('button', { name: 'New character' }));
    // The whole point: the first click opens a dialog, it does not generate.
    expect(onRegenerate).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('says plainly that no copy exists when none does', async () => {
    const user = userEvent.setup();
    render(<CharacterSheet character={character} onRegenerate={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'New character' }));
    expect(
      screen.getByText(/never exported this character, so no copy of it exists/)
    ).toBeInTheDocument();
  });

  it('names the last export when there is one', async () => {
    const user = userEvent.setup();
    render(
      <CharacterSheet
        character={{ ...character, exportedAt: '2026-08-20T10:00:00.000Z' }}
        onRegenerate={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'New character' }));
    expect(
      screen.getByText(/You last exported this character on/)
    ).toBeInTheDocument();
  });

  it('offers the export inside the dialog, before the destructive button', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(
      <CharacterSheet
        character={character}
        onExport={onExport}
        onRegenerate={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'New character' }));
    const dialog = screen.getByRole('alertdialog');
    const exportBtn = within(dialog).getByRole('button', {
      name: 'Export first',
    });
    const discard = within(dialog).getByRole('button', {
      name: /Discard and roll a new one/,
    });
    expect(exportBtn.compareDocumentPosition(discard)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    await user.click(exportBtn);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('backs out without destroying anything', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    render(
      <CharacterSheet character={character} onRegenerate={onRegenerate} />
    );
    await user.click(screen.getByRole('button', { name: 'New character' }));
    await user.click(
      screen.getByRole('button', { name: `Keep ${character.name}` })
    );
    expect(onRegenerate).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('regenerates only after the second, explicit press', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    render(
      <CharacterSheet character={character} onRegenerate={onRegenerate} />
    );
    await user.click(screen.getByRole('button', { name: 'New character' }));
    await user.click(
      screen.getByRole('button', { name: /Discard and roll a new one/ })
    );
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});

describe('the skill list is two columns wide (#59)', () => {
  it('lays skills out in a grid rather than one per row', () => {
    // Measured on production: each 298px row held ~55px of text, so 73-88% of
    // every row was empty, and twenty of them made the sheet 2116px of a
    // 3318px page. Two columns halves the row count at the same row height.
    const { container } = render(<CharacterSheet character={character} />);
    const lists = container.querySelectorAll('ul');
    expect(lists.length).toBeGreaterThan(0);
    lists.forEach((ul) => {
      expect(ul.className).toContain('grid-cols-2');
      expect(ul.className).not.toContain('flex-col');
    });
  });

  it('KEEPS THE 44px TARGET — it halves the row count, never the row height', () => {
    // `mobile-touch-targets.spec.ts` carries a coverage floor precisely so
    // nobody shrinks a target to make a layout fit (#396). This change buys its
    // space from the column count instead.
    const { container } = render(
      <CharacterSheet character={character} onRoll={() => {}} />
    );
    const rows = container.querySelectorAll('li > button');
    expect(rows).toHaveLength(20);
    rows.forEach((b) => expect(b.className).toContain('min-h-11'));
  });

  it('gives the OPEN row the full width, so the roller is not trapped in a column', () => {
    // `renderExpanded` mounts the roller inside the `li` on purpose — the row
    // you touch opens under your thumb. In a two-column grid that would put a
    // dice tray, a spend control and a Roll button in a ~147px column.
    const { container } = render(
      <CharacterSheet
        character={character}
        onRoll={() => {}}
        expandedSkill="Search"
        renderExpanded={() => <div data-testid="panel">roller</div>}
      />
    );
    const spanning = container.querySelectorAll('li.col-span-2');
    expect(spanning).toHaveLength(1);
    expect(spanning[0].querySelector('[data-testid="panel"]')).not.toBeNull();
  });

  it('lets a cell shrink inside its track', () => {
    // A grid item defaults to `min-width: auto`, which lets a long skill name
    // push the cell wider than its column instead of fitting inside it. That is
    // the overflow this change was most likely to cause, and 320px is where it
    // would have landed.
    const { container } = render(<CharacterSheet character={character} />);
    const items = container.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
    items.forEach((li) => expect(li.className).toContain('min-w-0'));
  });
});
