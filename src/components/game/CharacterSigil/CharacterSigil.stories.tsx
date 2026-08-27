import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CharacterSigil from './CharacterSigil';
import { generateCharacter } from '@/lib/geolarp/character';

const meta = {
  title: 'Features/Game/CharacterSigil',
  component: CharacterSigil,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof CharacterSigil>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { character: generateCharacter('Ada Wren'), decorative: true },
};

/** At the 48px it is mounted at, beside the character's name. */
export const OnTheSheet: Story = {
  args: {
    character: generateCharacter('Ada Wren'),
    decorative: true,
    size: 48,
  },
};

/** Named, for a context where the sigil is the only thing identifying it. */
export const Named: Story = {
  args: {
    character: generateCharacter('Ada Wren'),
    label: "Ada Wren's sigil",
    size: 96,
  },
};
