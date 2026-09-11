import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import NonceChallengeModal from './NonceChallengeModal';

/**
 * Storybook renders against the real `supabase` client, so opening this story would
 * attempt a genuine `reauthenticate()` — and that costs one of TWO project-wide emails
 * per hour, shared with signup confirmations. The default story is therefore CLOSED, and
 * the open one is documented as making that call.
 */
const meta: Meta<typeof NonceChallengeModal> = {
  title: 'Features/Authentication/NonceChallengeModal',
  component: NonceChallengeModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Collects the 6-digit code gotrue emails when a session is older than 24 hours. ' +
          'Hands the code back to the caller rather than updating anything itself. ' +
          'Not to be confused with ReAuthModal, which is the messaging encryption password.',
      },
    },
  },
  argTypes: {
    isOpen: { control: 'boolean' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof NonceChallengeModal>;

export const Closed: Story = {
  args: {
    isOpen: false,
    onSubmit: () => {},
    onClose: () => {},
  },
};

/** Opening this sends a real email against a 2-per-hour, project-wide budget. */
export const Open: Story = {
  args: {
    isOpen: true,
    onSubmit: () => {},
    onClose: () => {},
  },
};
