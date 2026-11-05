import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaySheet from './PlaySheet';
import {
  SKILLS,
  generateCharacter,
  toExportJSON,
} from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';

const DAY = new Date('2026-11-04T12:00:00Z');

// jsdom's File has no text(); a browser's does. Give the test file one.
function fileOf(content: string, name: string): File {
  const file = new File([content], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(content),
  });
  return file;
}

async function create(name: string) {
  await userEvent.type(await screen.findByLabelText('Name'), name);
  await userEvent.click(
    screen.getByRole('button', { name: 'Create character' })
  );
  await screen.findByRole('heading', { name, level: 2 });
}

describe('PlaySheet', () => {
  beforeEach(() => window.localStorage.clear());

  it('opens on character creation when the device holds no character', async () => {
    render(<PlaySheet today={DAY} />);
    expect(
      await screen.findByRole('heading', { name: 'Make a character' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Import a character file' })
    ).toBeInTheDocument();
  });

  it('creates a character, shows the whole sheet, and stores it in this browser', async () => {
    render(<PlaySheet today={DAY} />);
    await create('Ada Wren');
    const skillButtons = Object.keys(SKILLS).map((s) =>
      screen.getByRole('button', { name: new RegExp(`^${s}`) })
    );
    expect(skillButtons).toHaveLength(20);
    // One skill per line: a flex column, not the two-column grid.
    expect(skillButtons[0].closest('ul')).toHaveClass('flex-col');
    expect(skillButtons[0].closest('ul')).not.toHaveClass('grid-cols-2');

    const stored = JSON.parse(
      window.localStorage.getItem('geolarp_characters')!
    );
    expect(stored.characters[0].name).toBe('Ada Wren');
  });

  it('shows the wallet at 5 with 0 of 5 earned today', async () => {
    render(<PlaySheet today={DAY} />);
    await create('Ada Wren');
    const wallet = screen.getByRole('region', { name: 'Character Points' });
    expect(within(wallet).getByText('5')).toBeInTheDocument();
    expect(screen.getByTestId('earned-today')).toHaveTextContent('0 of 5');
  });

  it('rolls a skill against a difficulty with the true odds shown', async () => {
    render(<PlaySheet today={DAY} />);
    await create('Ada Wren');
    await userEvent.selectOptions(
      screen.getByLabelText('Difficulty'),
      'heroic'
    );
    await userEvent.click(screen.getByRole('button', { name: /^Search/ }));
    expect(screen.getByText(/Chance on this roll/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Roll/ }));
    // A heroic target cannot be reached by a plain 3-4 die pool: a miss, with
    // the odds of winning from there printed before any point is spent.
    expect(await screen.findAllByText(/to win from here/)).not.toHaveLength(0);
  });

  it('keeps more than one character on the device and switches between them', async () => {
    render(<PlaySheet today={DAY} />);
    await create('Ada Wren');
    await userEvent.click(
      screen.getByRole('button', { name: 'New character' })
    );
    await create('Bram Holt');
    const lib = screen.getByRole('region', {
      name: 'Characters on this device',
    });
    expect(
      within(lib).getByRole('button', { name: 'Ada Wren' })
    ).toBeInTheDocument();
    await userEvent.click(
      within(lib).getByRole('button', { name: 'Ada Wren' })
    );
    expect(
      screen.getByRole('heading', { name: 'Ada Wren', level: 2 })
    ).toBeInTheDocument();
  });

  it('warns that a never-exported character has no copy before removing it', async () => {
    render(<PlaySheet today={DAY} />);
    await create('Ada Wren');
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from this device' })
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('never exported');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Keep Ada Wren' })
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Ada Wren', level: 2 })
    ).toBeInTheDocument();
  });

  it('imports a file as a new character', async () => {
    render(<PlaySheet today={DAY} />);
    await create('Ada Wren');
    const file = fileOf(
      toExportJSON({
        ...generateCharacter('Cass Dray', new Rng('cass')),
        created: '2026-01-01T00:00:00.000Z',
      }),
      'cass.json'
    );
    await userEvent.upload(screen.getByTestId('import-file'), file);
    expect(
      await screen.findByRole('heading', { name: 'Cass Dray', level: 2 })
    ).toBeInTheDocument();
  });

  it('asks before an import overwrites the same character, and refuses a bad file in words', async () => {
    render(<PlaySheet today={DAY} />);
    await create('Ada Wren');
    const mine = JSON.parse(window.localStorage.getItem('geolarp_characters')!)
      .characters[0];
    const same = fileOf(
      JSON.stringify({ ...mine, characterPoints: 0 }),
      'ada.json'
    );
    await userEvent.upload(screen.getByTestId('import-file'), same);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Replace Ada Wren on this device?');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Keep the copy here' })
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await userEvent.upload(
      screen.getByTestId('import-file'),
      fileOf('nope', 'bad.json')
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'not a geoLARP character'
    );
  });
});
