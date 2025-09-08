# PRP-004: Testing Infrastructure

## Status
Queue

## Priority
High

## Prerequisites
- PRP-001: Next.js Project Setup completed
- PRP-002: Docker Development Environment completed
- PRP-003: Storybook Component System completed

## Overview
Establish comprehensive testing infrastructure with Playwright for E2E testing, Jest for unit testing, and TypeScript in strict mode. All testing will run in Docker containers to ensure consistency and enable visual feedback loops.

## Success Criteria
- [ ] Playwright configured for E2E testing in Docker
- [ ] Jest and React Testing Library setup
- [ ] TypeScript in strict mode from the start
- [ ] Visual regression testing with Playwright
- [ ] Accessibility testing with axe-core
- [ ] Performance testing baselines
- [ ] Test coverage reporting (>80%)
- [ ] CI/CD integration ready
- [ ] Mobile device testing emulation
- [ ] Geolocation mocking for location tests
- [ ] Offline scenario testing
- [ ] Test data factories

## Technical Requirements

### TypeScript Configuration
Note: TypeScript strict mode configuration is already set up in PRP-001. This PRP focuses on testing-specific TypeScript configurations.

```json
// tsconfig.test.json (for test files)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react"
  },
  "include": [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "e2e/**/*.ts"
  ]
}
```

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Geolocation mocking
    geolocation: { longitude: -73.9855, latitude: 40.7580 },
    permissions: ['geolocation'],
  },

  projects: [
    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    // Tablet
    {
      name: 'iPad',
      use: { ...devices['iPad (gen 7)'] },
    },
    // Desktop
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})

// Dockerfile.playwright
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Enable pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy application
COPY . .

# Install Playwright browsers
RUN pnpm exec playwright install --with-deps

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app

USER nextjs

# Run tests
CMD ["pnpm", "test:e2e"]
```

### Jest Configuration
```javascript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/*.config.js',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
}

module.exports = createJestConfig(customJestConfig)

// jest.setup.js
import '@testing-library/jest-dom'
import { mockGeolocation } from './test-utils/mocks'

// Mock geolocation
beforeAll(() => {
  mockGeolocation({
    latitude: 40.7580,
    longitude: -73.9855,
    accuracy: 10,
  })
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}
```

### Test Utils and Factories
```typescript
// test-utils/test-factory.ts
import { faker } from '@faker-js/faker'

export const createUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  level: faker.number.int({ min: 1, max: 20 }),
  experience: faker.number.int({ min: 0, max: 10000 }),
  ...overrides,
})

export const createLocation = (overrides = {}) => ({
  latitude: faker.location.latitude(),
  longitude: faker.location.longitude(),
  accuracy: faker.number.int({ min: 5, max: 100 }),
  timestamp: Date.now(),
  ...overrides,
})

export const createGeofence = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.location.city(),
  center: createLocation(),
  radius: faker.number.int({ min: 100, max: 1000 }),
  ...overrides,
})

// test-utils/render.tsx
import { render as rtlRender } from '@testing-library/react'
import { ReactElement } from 'react'

function render(ui: ReactElement, options = {}) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider>
        <QueryClientProvider>
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    ),
    ...options,
  })
}

export * from '@testing-library/react'
export { render }
```

### E2E Test Examples
```typescript
// e2e/location.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Location Features', () => {
  test.beforeEach(async ({ context }) => {
    // Grant permission before each test
    await context.grantPermissions(['geolocation'])
  })

  test('should request location permission', async ({ page }) => {
    await page.goto('/test-location')
    
    // Check permission UI
    await expect(page.getByText('Location permission required')).toBeVisible()
    
    // Click enable
    await page.getByRole('button', { name: 'Enable' }).click()
    
    // Verify location is displayed
    await expect(page.getByText(/40\.7580/)).toBeVisible()
  })

  test('should work offline', async ({ page, context }) => {
    // Go to page first
    await page.goto('/test-location')
    
    // Go offline
    await context.setOffline(true)
    
    // Should show cached content
    await expect(page.getByText('Offline Mode')).toBeVisible()
  })

  test('mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/test-location')
    
    // Check mobile-specific UI
    await expect(page.getByTestId('bottom-nav')).toBeVisible()
    await expect(page.getByTestId('desktop-sidebar')).not.toBeVisible()
  })
})
```

### Visual Regression Testing
```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Visual Regression', () => {
  test('homepage snapshot', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('dark mode snapshot', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="theme-toggle"]')
    await expect(page).toHaveScreenshot('homepage-dark.png')
  })
})
```

### Accessibility Testing
```typescript
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility', () => {
  test('should not have violations on homepage', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/')
    
    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'start-button')
    
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'settings-button')
  })
})
```

## CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run type-check
      
      - name: Lint
        run: npm run lint
      
      - name: Unit tests
        run: npm run test:unit -- --coverage
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## Testing Strategy
1. **Unit Tests**: Pure functions, utilities, hooks
2. **Integration Tests**: Component interactions, API calls
3. **E2E Tests**: User journeys, critical paths
4. **Visual Tests**: UI consistency, responsive design
5. **Performance Tests**: Load times, bundle size
6. **Accessibility Tests**: WCAG compliance

## Acceptance Criteria
1. All tests run in Docker containers
2. TypeScript catches type errors at compile time
3. 80%+ code coverage maintained
4. E2E tests cover critical user paths
5. Visual regressions detected automatically
6. Tests run in parallel for speed
7. Mobile devices properly emulated

### Docker Compose Addition
```yaml
# Add to docker-compose.yml
services:
  playwright:
    build:
      context: .
      dockerfile: Dockerfile.playwright
    volumes:
      - .:/app
      - /app/node_modules
      - /app/test-results
    environment:
      - CI=true
    depends_on:
      - app
    profiles:
      - test
```

---
*Created: 2024-01-08*
*Updated: 2024-01-08*
*Estimated effort: 2 days*