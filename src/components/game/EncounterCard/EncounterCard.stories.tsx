import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import EncounterCard from './EncounterCard';
import { encounterFor, ENCOUNTER_KINDS } from '@/lib/geolarp/encounter';
import { cellOf, seedOf } from '@/lib/geolarp/cell';
import { roll } from '@/lib/geolarp/dice';
import { Rng } from '@/lib/geolarp/rng';

const meta: Meta<typeof EncounterCard> = {
  title: 'Features/Game/EncounterCard',
  component: EncounterCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'What is in a 100-metre cell. The content is a pure function of the ' +
          "cell's coordinates and today's date, so every player standing in " +
          'the same cell on the same day meets the same thing. The card shows ' +
          'the seed so they can check that.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const cell = cellOf(35.0456, -85.3097);
const day = new Date('2026-08-26T12:00:00Z');
const encounter = encounterFor(seedOf(cell, day));

/** One seed per kind, so every story shows the kind it claims to. */
function ofKind(kind: (typeof ENCOUNTER_KINDS)[number]) {
  for (let i = 0; i < 2000; i += 1) {
    const e = encounterFor(`demo-${i}@2026-08-26`);
    if (e.kind === kind) return e;
  }
  return encounter;
}

export const Default: Story = {
  args: { encounter, cell },
};

export const Monster: Story = { args: { encounter: ofKind('monster'), cell } };
export const Trader: Story = { args: { encounter: ofKind('trader'), cell } };
export const Cache: Story = { args: { encounter: ofKind('cache'), cell } };
export const Shrine: Story = { args: { encounter: ofKind('shrine'), cell } };
export const Trap: Story = { args: { encounter: ofKind('trap'), cell } };

export const Resolved: Story = {
  name: 'Resolved — success',
  args: {
    encounter,
    cell,
    result: roll({ dice: 8, pips: 0 }, new Rng('win'), 2),
  },
};

export const Failed: Story = {
  name: 'Resolved — failure',
  args: {
    encounter,
    cell,
    result: roll({ dice: 1, pips: 0 }, new Rng('lose'), 99),
  },
};

export const WithoutALocation: Story = {
  name: 'No cell — grid movement with GPS denied',
  parameters: {
    docs: {
      description: {
        story:
          'Deny location and the game still plays. Without a cell the card ' +
          'drops the location line and keeps the seed.',
      },
    },
  },
  args: { encounter },
};
