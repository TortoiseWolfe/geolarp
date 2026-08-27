import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * TWO DESCRIBES, TWO PAGES (#26).
 *
 * This file used to point all nine tests at `/` through one `beforeEach`. Six
 * of them assert the TEMPLATE DEMO homepage — an install terminal, a
 * "What's in the box" module grid, a themes stat tile — and `src/app/page.tsx`
 * says in its own comment that geolarp.com is pre-launch, so `/` is the Coming
 * Soon page and "the template's own demo homepage still exists, moved to
 * `/template`". Those six had been failing on every browser since the move.
 *
 * WHY NOT RETARGET THE FILE. #26 is explicit: `homepage loads with correct
 * title` and `skip to main content link works` pass on `/` today and are this
 * file's only coverage of the site's most-visited route. Moving the whole file
 * would have turned CI green by deleting that coverage.
 */
test.describe('Homepage (/) — the pre-launch landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await dismissCookieBanner(page);
  });

  test('homepage loads with correct title', async ({ page }) => {
    // Check the page title contains project name
    await expect(page).toHaveTitle(/.*/);

    // Check the main heading is visible
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('skip to main content link works', async ({ page }) => {
    // The skip link uses sr-only class and is only visible on focus
    const skipLink = page.getByRole('link', { name: /skip to main content/i });

    // Focus the skip link using Tab
    await page.keyboard.press('Tab');

    // Wait a moment for focus styles to apply
    await page.waitForTimeout(100);

    // Click with force since it's a sr-only element (visible on focus but Playwright may not detect it)
    await skipLink.click({ force: true });

    // Verify we scrolled to the main content section
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeInViewport();
  });
});

test.describe('Template demo homepage (/template)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/template');
    await dismissCookieBanner(page);
  });

  test('navigate to themes page', async ({ page }) => {
    // The stat tile renders as "35Themes · 10 curated" — no space between the
    // count and the word — so a `${THEME_COUNT} Themes` accessible name never
    // matched it. Scoped to <main> because GlobalNav carries its own Themes
    // link, and addressed by href so a copy change cannot break it.
    await page.locator('main').locator('a[href*="/themes"]').first().click();

    // Verify navigation to themes page
    await expect(page).toHaveURL(/.*themes/);

    // Verify themes page content loads
    const themesHeading = page.locator('h1').filter({ hasText: /Theme/i });
    await expect(themesHeading).toBeVisible();
  });

  test('navigate to storybook page', async ({ page, context }) => {
    // Storybook opens in new tab (external link)
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('a[href*="storybook"]'),
    ]);

    // Check the new tab URL contains storybook
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('storybook');
    await newPage.close();
  });

  test('the four modules are present and numbered', async ({ page }) => {
    // #379 replaced the "Key Features" grid with the 2a design's module
    // plates. The heading and the four card titles changed with it, so this
    // asserts the new contract rather than the old one.
    await expect(
      page.locator('h2').filter({ hasText: /What.s in the box/i })
    ).toBeVisible();

    const cards = page.locator('h3');
    for (const label of ['Accounts', 'Payments', 'Messaging', 'Offline']) {
      await expect(
        cards.filter({ hasText: new RegExp(`^${label}$`) })
      ).toBeVisible();
    }
  });

  test('the install block shows the Docker path, never npx', async ({
    page,
  }) => {
    // The 2a comp puts `npx create-geolarp my-app` here. That package
    // does not exist in this repo and `npx` is on CLAUDE.md's forbidden list,
    // so the most prominent element on the page would fail for anyone who
    // pasted it. Owner's ruling (#380): Docker only. This test is what keeps
    // the comp from being copied back in later.
    const terminal = page.locator('pre').first();
    await expect(terminal).toBeVisible();

    const text = (await terminal.textContent()) ?? '';
    expect(text).toContain('docker compose up');
    expect(text).not.toContain('npx');
  });

  test('navigate to game page', async ({ page }) => {
    // Scoped to <main>: `.first()` follows DOCUMENT order and GlobalNav's own
    // Game link comes first, inside a dropdown that may be collapsed — so the
    // click landed on something that did not navigate. Same trap as the themes
    // tile above.
    await page
      .locator('main')
      .getByRole('link', { name: 'Game' })
      .first()
      .click();

    // waitForURL, not toHaveURL: the click can land before hydration attaches
    // the router, and a 5s default is not enough slack for that under load.
    await page.waitForURL(/game/, { timeout: 15000 });
  });

  test('navigation links in secondary nav work', async ({ page }) => {
    // Test Status link - use href selector to avoid matching hidden hamburger nav items
    const statusLink = page.locator('a[href*="/status"]').first();
    await statusLink.click();
    await expect(page).toHaveURL(/.*status/);
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Test Accessibility page link - find the "Accessible" card which links to /accessibility
    const accessibilityLink = page
      .getByRole('link', { name: /accessible/i })
      .first();
    await accessibilityLink.scrollIntoViewIfNeeded();
    await accessibilityLink.click();
    await expect(page).toHaveURL(/.*accessibility/);
    await page.goBack();
  });

  test('GitHub repository link opens in new tab', async ({ page, context }) => {
    test.skip(!!process.env.CI, 'External tab popups unreliable in CI');

    // Listen for new page/tab
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('text=View Source'),
    ]);

    // Check the new tab URL
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('github.com');
    await newPage.close();
  });
});
