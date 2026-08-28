import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import OAuthButtons from './OAuthButtons';

// `NEXT_PUBLIC_*` is inlined at build, so Storybook cannot enable a provider at
// runtime — without an explicit `providers` prop this component correctly
// renders nothing (#9). The stories pass it so the buttons are visible here.
const meta: Meta<typeof OAuthButtons> = {
  title: 'Features/Authentication/OAuthButtons',
  component: OAuthButtons,
  args: { providers: ['github', 'google'] },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Social OAuth login buttons (GitHub, Google).',
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/sign-in',
        query: {},
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
