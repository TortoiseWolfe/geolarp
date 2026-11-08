import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import CharacterBuilder from './CharacterBuilder';

const meta: Meta<typeof CharacterBuilder> = {
  title: 'Features/Game/CharacterBuilder',
  component: CharacterBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Character creation: a name, five attributes inside the 15D ' +
          'budget (2D to 4D each) and twenty skills inside 7D. The defaults ' +
          'are already a legal character, so a name is all that is required.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onCreate: fn() } };

export const WithCancel: Story = { args: { onCreate: fn(), onCancel: fn() } };
