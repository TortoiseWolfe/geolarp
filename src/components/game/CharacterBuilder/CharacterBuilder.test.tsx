import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CharacterBuilder from './CharacterBuilder';
import { formatCode } from '@/lib/geolarp/dice';
import type { Character } from '@/lib/geolarp/character';

describe('CharacterBuilder', () => {
  it('makes a legal character from a name alone', async () => {
    const onCreate = vi.fn();
    render(<CharacterBuilder onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Ada Wren');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create character' })
    );
    const c = onCreate.mock.calls[0][0] as Character;
    expect(c.name).toBe('Ada Wren');
    expect(formatCode(c.attributes.Strength)).toBe('3d7');
    expect(c.characterPoints).toBe(5);
  });

  it('asks for a name instead of creating a nameless character', async () => {
    const onCreate = vi.fn();
    render(<CharacterBuilder onCreate={onCreate} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Create character' })
    );
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Give your character a name.'
    );
  });

  it('shows all twenty skills, one per line, each at its attribute', () => {
    render(<CharacterBuilder onCreate={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /^Raise / })).toHaveLength(25);
    const skills = screen.getByRole('group', { name: 'Skills' });
    expect(skills.querySelectorAll('li')).toHaveLength(20);
  });

  it('moves an attribute pip, keeps the budget, and reports a refusal', async () => {
    render(<CharacterBuilder onCreate={vi.fn()} />);
    const status = screen.getByRole('status', { name: 'Attribute dice left' });
    expect(status).toHaveTextContent('All 15D spent.');

    await userEvent.click(
      screen.getByRole('button', { name: 'Raise Strength' })
    );
    expect(screen.getByTestId('builder-hint')).toHaveTextContent(
      'No attribute dice left'
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Lower Strength' })
    );
    expect(status).toHaveTextContent('1 pip of 15D left');
    await userEvent.click(screen.getByRole('button', { name: 'Raise Luck' }));
    expect(status).toHaveTextContent('All 15D spent.');
  });

  it('will not create while attribute dice are unspent', async () => {
    const onCreate = vi.fn();
    render(<CharacterBuilder onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    await userEvent.click(
      screen.getByRole('button', { name: 'Lower Strength' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create character' })
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('trains a skill and stores it above its attribute', async () => {
    const onCreate = vi.fn();
    render(<CharacterBuilder onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    await userEvent.type(screen.getByLabelText(/Concept/), 'Ferry pilot');
    await userEvent.click(screen.getByRole('button', { name: 'Raise Search' }));
    await userEvent.click(screen.getByRole('button', { name: 'Raise Search' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Create character' })
    );
    const c = onCreate.mock.calls[0][0] as Character;
    expect(formatCode(c.skills.Search!)).toBe('3d7+2');
    expect(c.concept).toBe('Ferry pilot');
  });

  it('can roll one for the player', async () => {
    const onCreate = vi.fn();
    render(<CharacterBuilder onCreate={onCreate} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Roll one for me' })
    );
    expect((onCreate.mock.calls[0][0] as Character).name).toBe('Wanderer');
  });
});
