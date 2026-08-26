import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import CharacterSheet from './CharacterSheet';
import { generateCharacter } from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';

const meta: Meta<typeof CharacterSheet> = {
  title: 'Features/Game/CharacterSheet',
  component: CharacterSheet,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A character sheet in West End Games D6 units, rolled on d7. Every ' +
          'rating is a dice code with pips — `3d7+2` — and skills sit under ' +
          'the attribute that governs them. An untrained skill shows its ' +
          "attribute's rating, because that is what the player rolls.",
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const ada = generateCharacter('Ada Wren', new Rng('sheet-fixture'));
const bram = generateCharacter('Bram Holt', new Rng('other'));

export const ReadOnly: Story = {
  name: 'Read-only',
  args: { character: ada },
};

export const Playable: Story = {
  args: {
    character: ada,
    onRoll: fn(),
    onExport: fn(),
    onRegenerate: fn(),
  },
};

export const ADifferentRoll: Story = {
  name: 'A different character',
  parameters: {
    docs: {
      description: {
        story:
          'Generation trains six to eight skills out of twenty, so two ' +
          'characters read as different people rather than as the same ' +
          'generalist twice.',
      },
    },
  },
  args: { character: bram, onRoll: fn() },
};

export const SpentDown: Story = {
  name: 'Character Points spent',
  args: {
    character: { ...ada, characterPoints: 0 },
    onRoll: fn(),
  },
};
