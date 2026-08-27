import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CharacterPlay from './CharacterPlay';

const meta: Meta<typeof CharacterPlay> = {
  title: 'Features/Game/CharacterPlay',
  component: CharacterPlay,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The playable surface: make a character, see what is in your ' +
          '100-metre cell, and roll against it. Location is optional — the ' +
          'default is a hand-picked zone, so nothing prompts for a permission ' +
          'before there is a game to play. State lives in `localStorage`, so ' +
          'the first story you open decides what the others show.',
      },
    },
  },
  tags: ['autodocs'],
  args: { today: new Date('2026-08-26T12:00:00Z') },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FreshBrowser: Story = {
  name: 'Fresh browser — character creation',
  parameters: {
    docs: {
      description: {
        story:
          'What a first-time visitor sees. Clearing `localStorage` for this ' +
          'origin returns any story to this state.',
      },
    },
  },
  loaders: [
    async () => {
      window.localStorage.removeItem('geolarp_character');
      return {};
    },
  ],
};

export const ADifferentDay: Story = {
  name: 'A different day, same cell',
  parameters: {
    docs: {
      description: {
        story:
          'The seed is the place AND the date, so the same cell holds ' +
          'something else tomorrow.',
      },
    },
  },
  args: { today: new Date('2026-08-27T12:00:00Z') },
};
