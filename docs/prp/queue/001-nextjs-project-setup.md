# PRP-001: Next.js Project Setup

## Status
Queue

## Priority
Critical

## Overview
Create the Next.js 14+ application foundation with TypeScript, Tailwind CSS, and DaisyUI. This establishes the base application that will be containerized in PRP-002.

## Success Criteria
- [ ] Next.js 14+ with App Router initialized
- [ ] TypeScript with strict mode configured
- [ ] ESLint and Prettier configured
- [ ] Tailwind CSS and DaisyUI installed
- [ ] Basic folder structure established
- [ ] Environment variables setup
- [ ] Git hooks with Husky configured
- [ ] Conventional commits enforced
- [ ] Package manager (pnpm) configured
- [ ] Development scripts created

## Technical Requirements

### Project Initialization
```bash
#!/bin/bash
# Initialize Next.js project with TypeScript
npx create-next-app@latest geolarp \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm

cd geolarp

# Install essential dependencies
pnpm add -D \
  @types/node \
  prettier \
  eslint-config-prettier \
  eslint-plugin-prettier \
  husky \
  @commitlint/cli \
  @commitlint/config-conventional \
  lint-staged

# Install UI libraries
pnpm add \
  daisyui \
  class-variance-authority \
  clsx \
  tailwind-merge

# Install testing dependencies (for later PRPs)
pnpm add -D \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @playwright/test \
  jest \
  jest-environment-jsdom \
  @storybook/nextjs \
  @storybook/react \
  @storybook/addon-essentials
```

### Project Structure
```
geolarp/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/           # Base UI components
│   │   └── game/         # Game-specific components
│   ├── hooks/
│   ├── lib/
│   │   └── utils/
│   ├── services/
│   ├── store/
│   └── types/
├── public/
│   └── assets/
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── .dockerignore
├── .env.example
├── .env.local
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── commitlint.config.js
├── next.config.mjs
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
└── tsconfig.json
```

### TypeScript Configuration (Strict Mode)
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    },
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Tailwind Configuration with DaisyUI
```javascript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        geolarp: {
          'primary': '#10b981',
          'primary-focus': '#059669',
          'primary-content': '#ffffff',
          'secondary': '#3b82f6',
          'secondary-focus': '#2563eb',
          'secondary-content': '#ffffff',
          'accent': '#f59e0b',
          'accent-focus': '#d97706',
          'accent-content': '#ffffff',
          'neutral': '#1f2937',
          'neutral-focus': '#111827',
          'neutral-content': '#f3f4f6',
          'base-100': '#ffffff',
          'base-200': '#f3f4f6',
          'base-300': '#e5e7eb',
          'base-content': '#1f2937',
          'info': '#3b82f6',
          'success': '#10b981',
          'warning': '#f59e0b',
          'error': '#ef4444',
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
      'emerald',
    ],
  },
}

export default config
```

### ESLint Configuration
```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prettier/prettier": "error"
  }
}
```

### Prettier Configuration
```json
// .prettierrc
{
  "semi": false,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky install",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

### Git Hooks Setup
```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
```

```bash
# .husky/commit-msg
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm commitlint --edit $1
```

### Lint-staged Configuration
```json
// package.json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,css}": [
      "prettier --write"
    ]
  }
}
```

### Commitlint Configuration
```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert'
      ]
    ]
  }
}
```

### VS Code Settings
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Testing Requirements
- Project initializes without errors
- TypeScript compiles with no errors
- ESLint and Prettier run successfully
- Git hooks work correctly
- All dependencies install cleanly
- Development server starts successfully

## Acceptance Criteria
1. Next.js app runs locally with `pnpm dev`
2. TypeScript strict mode catches type errors
3. Code quality tools are configured
4. Git commits are validated
5. Project structure is organized
6. DaisyUI components are available

## Dependencies
- Node.js 20+
- pnpm 8+
- Git

## Notes
- This PRP creates the base application that will be containerized in PRP-002
- All development after this will happen in Docker containers
- Storybook and testing setup will be completed in subsequent PRPs

---
*Created: 2024-01-08*
*Updated: 2024-01-08*
*Estimated effort: 0.5 days*