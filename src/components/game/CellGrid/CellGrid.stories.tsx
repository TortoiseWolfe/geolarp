import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CellGrid from './CellGrid';

const meta = {
  title: 'Features/Game/CellGrid',
  component: CellGrid,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof CellGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const centre = { x: -77750, y: 39012 };
const today = new Date('2026-08-26T12:00:00Z');

export const Default: Story = {
  args: { centre, today },
};

/** With movement wired up: eight tiles become buttons, the centre does not. */
export const Walkable: Story = {
  args: { centre, today, onStep: () => {} },
};

/** The 320px case the pip decision was measured against. */
export const Narrow: Story = {
  args: { centre, today, onStep: () => {} },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  decorators: [
    (StoryFn) => (
      <div style={{ width: 288 }}>
        <StoryFn />
      </div>
    ),
  ],
};
