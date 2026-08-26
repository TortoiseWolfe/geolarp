import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import D7Roller from './D7Roller';
import { Rng } from '@/lib/geolarp/rng';

const meta: Meta<typeof D7Roller> = {
  title: 'Features/Game/D7Roller',
  component: D7Roller,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Rolls a d7 pool with the Wild Die. Ratings are dice codes with ' +
          'pips (`3d7+2`), as in West End Games D6 — three pips make a die. ' +
          'The wild die is the first shown; it explodes on a 7 and ' +
          'complicates on a 1.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text', description: 'What is being rolled' },
    difficulty: {
      control: 'select',
      options: [
        undefined,
        'very-easy',
        'easy',
        'moderate',
        'difficult',
        'very-difficult',
        'heroic',
      ],
      description: 'Target band from the rescaled ladder',
    },
    availablePoints: {
      control: { type: 'number', min: 0, max: 5 },
      description: 'Character Points the player may spend, one die each',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Search', rating: { dice: 3, pips: 0 } },
};

export const AgainstADifficulty: Story = {
  args: {
    label: 'Stealth',
    rating: { dice: 4, pips: 2 },
    difficulty: 'moderate',
  },
};

export const WithCharacterPoints: Story = {
  name: 'With Character Points to spend',
  args: {
    label: 'Brawl',
    rating: { dice: 3, pips: 1 },
    difficulty: 'difficult',
    availablePoints: 3,
  },
};

export const OutmatchedByTheCell: Story = {
  name: 'Outmatched — a Heroic cell',
  parameters: {
    docs: {
      description: {
        story:
          'A cell is rated by the place, not by who is standing in it. A ' +
          'starting sheet cannot reach Heroic on dice alone, which is what ' +
          'Character Points and coming back later are for.',
      },
    },
  },
  args: {
    label: 'Lore',
    rating: { dice: 2, pips: 0 },
    difficulty: 'heroic',
    availablePoints: 5,
  },
};

export const Reproducible: Story = {
  name: 'Seeded — the same roll every time',
  args: {
    label: 'Navigate',
    rating: { dice: 3, pips: 2 },
    difficulty: 'easy',
    rng: new Rng('storybook'),
  },
};
