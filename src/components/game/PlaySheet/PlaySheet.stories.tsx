import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PlaySheet from './PlaySheet';

const meta: Meta<typeof PlaySheet> = {
  title: 'Features/Game/PlaySheet',
  component: PlaySheet,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The MVP character sheet: a local library of characters, the ' +
          'full twenty-skill sheet, the roller, the Character Points wallet ' +
          'and export or import as a file. Local-only: no account, no ' +
          'location, no network.',
      },
    },
  },
  decorators: [
    (Story) => {
      // Always open on the first-visit state, not whatever a previous story saved.
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('geolarp_character');
        window.localStorage.removeItem('geolarp_characters');
      }
      return <Story />;
    },
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstVisit: Story = {
  args: { today: new Date('2026-11-04T12:00:00Z') },
};
