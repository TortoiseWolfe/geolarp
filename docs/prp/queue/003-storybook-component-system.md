# PRP-003: Storybook Component System

## Status

Queue

## Priority

Critical

## Prerequisites

- PRP-001: Next.js Project Setup completed
- PRP-002: Docker Development Environment completed

## Overview

Establish a component-driven development workflow using Storybook for visual development and DaisyUI for consistent, mobile-first design. All components will be developed in isolation with visual testing before integration.

## Success Criteria

- [ ] Storybook running in Docker container
- [ ] DaisyUI properly configured with custom theme
- [ ] Mobile-first responsive components
- [ ] Component documentation in Storybook
- [ ] Visual regression testing setup
- [ ] Accessibility testing integrated
- [ ] Dark/light theme switching
- [ ] Component playground for designers
- [ ] Chromatic or Percy for visual diffs
- [ ] Design tokens documented
- [ ] Component library published to npm (internal)

## Technical Requirements

### Storybook Configuration

```javascript
// .storybook/main.js
module.exports = {
  stories: ['../components/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-viewport',
    '@storybook/addon-docs',
    'storybook-addon-themes',
    '@storybook/addon-interactions',
    'storybook-mobile',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  features: {
    buildStoriesJson: true,
  },
  staticDirs: ['../public'],
};

// .storybook/preview.js
import '../app/globals.css';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  viewport: {
    viewports: {
      mobile: {
        name: 'Mobile',
        styles: { width: '375px', height: '812px' },
      },
      tablet: {
        name: 'Tablet',
        styles: { width: '768px', height: '1024px' },
      },
    },
    defaultViewport: 'mobile',
  },
  themes: {
    default: 'light',
    list: [
      { name: 'light', class: 'light', color: '#ffffff' },
      { name: 'dark', class: 'dark', color: '#1f2937' },
      { name: 'emerald', class: 'emerald', color: '#10b981' },
    ],
  },
};
```

### DaisyUI Theme Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './stories/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        geolarp: {
          primary: '#10b981',
          'primary-focus': '#059669',
          'primary-content': '#ffffff',

          secondary: '#3b82f6',
          'secondary-focus': '#2563eb',
          'secondary-content': '#ffffff',

          accent: '#f59e0b',
          'accent-focus': '#d97706',
          'accent-content': '#ffffff',

          neutral: '#1f2937',
          'neutral-focus': '#111827',
          'neutral-content': '#f3f4f6',

          'base-100': '#ffffff',
          'base-200': '#f3f4f6',
          'base-300': '#e5e7eb',
          'base-content': '#1f2937',

          info: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',

          '--rounded-box': '1rem',
          '--rounded-btn': '0.5rem',
          '--rounded-badge': '1.9rem',
          '--animation-btn': '0.25s',
          '--animation-input': '0.2s',
          '--btn-text-case': 'normal',
          '--btn-focus-scale': '0.95',
          '--border-btn': '1px',
          '--tab-border': '1px',
          '--tab-radius': '0.5rem',
        },
      },
      'dark',
      'light',
    ],
  },
};
```

### Component Structure

```typescript
// components/Button/Button.tsx
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'btn',
  {
    variants: {
      variant: {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        accent: 'btn-accent',
        ghost: 'btn-ghost',
        link: 'btn-link',
      },
      size: {
        sm: 'btn-sm',
        md: '',
        lg: 'btn-lg',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, fullWidth, className })}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <span className="loading loading-spinner" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

// components/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'accent', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    children: 'Button',
    variant: 'primary',
  },
}

export const Mobile: Story = {
  args: {
    children: 'Start Adventure',
    variant: 'primary',
    fullWidth: true,
    size: 'lg',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
  },
}
```

### Mobile-First Components

- Navigation: Bottom tab bar for mobile, sidebar for desktop
- Cards: Full-width on mobile, grid on desktop
- Forms: Stacked on mobile, inline on desktop
- Modals: Full-screen on mobile, centered on desktop
- Tables: Scrollable on mobile, fixed on desktop

### Visual Testing

```javascript
// .storybook/test-runner.js
module.exports = {
  async postRender(page, context) {
    // Visual regression snapshot
    await page.screenshot({
      path: `screenshots/${context.id}.png`,
      fullPage: true,
    });

    // Accessibility audit
    const accessibilityReport = await page.accessibility();
    if (accessibilityReport.violations.length > 0) {
      throw new Error('Accessibility violations found');
    }
  },
};
```

### Component Categories

1. **Layout Components**
   - Container, Grid, Stack, Divider
   - MobileNav, DesktopNav, BottomBar
   - Header, Footer, Sidebar

2. **Data Display**
   - Card, List, Table, Stats
   - Avatar, Badge, Progress
   - Timeline, Tooltip

3. **Input Components**
   - Button, Input, Select, Checkbox
   - Radio, Toggle, Range, TextArea
   - DatePicker, FilePicker

4. **Feedback Components**
   - Alert, Toast, Modal, Drawer
   - Loading, Skeleton, Empty
   - Error, Success

5. **Game-Specific Components**
   - CharacterCard, DiceRoller, Map
   - InventoryGrid, QuestLog
   - GeofenceZone, BatteryIndicator

## Testing Requirements

- All components have stories
- Visual regression tests pass
- Accessibility score > 95
- Mobile viewport tests included
- Touch interactions tested
- Theme switching works
- RTL support validated

## Acceptance Criteria

1. Developers can build UI without running full app
2. Designers can review and approve components
3. Components are consistent across app
4. Mobile experience is primary focus
5. Accessibility is built-in, not added
6. Documentation is auto-generated

## Docker Integration

```dockerfile
# Dockerfile.storybook
FROM node:20-alpine AS base

# Enable pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy application
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 6006
CMD ["pnpm", "storybook"]
```

### Docker Compose Addition

```yaml
# Add to docker-compose.yml
services:
  storybook:
    build:
      context: .
      dockerfile: Dockerfile.storybook
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - '6006:6006'
    environment:
      - NODE_ENV=development
    stdin_open: true
    tty: true
```

---

_Created: 2024-01-08_
_Estimated effort: 3 days_
