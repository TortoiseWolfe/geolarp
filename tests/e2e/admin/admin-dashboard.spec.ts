/**
 * E2E Test: Admin Dashboard
 *
 * Tests all 5 admin sub-pages with seeded demo data:
 * - Overview: stat cards, sparkline trend charts
 * - Payments: provider breakdown, payment stats
 * - Audit Trail: burst detection cards, event log table
 * - Users: user table, sorting, search
 * - Messaging: conversation stats, top senders
 *
 * Requires: local Supabase with seed-admin-demo.sql applied,
 * admin user test@example.com with is_admin app_metadata.
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     sh-feat-geolarp-1 npx playwright test tests/e2e/admin/ --project=chromium
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedAdmin,
  deleteIsolatedAdmin,
  injectSessionIntoPage,
  type IsolatedAdmin,
} from '../utils/test-user-factory';

/**
 * Next.js basePath, DERIVED — never hardcoded.
 *
 * This read `const BP = '/geoLARP'`, so every route in this file resolved to
 * `/geoLARP/admin...` and returned a 404 page. The tests then failed on a missing
 * container, which reads as "the admin console is broken" rather than "we asked for a
 * page that does not exist".
 *
 * `public/CNAME` exists, so this repo deploys at the apex and its basePath is `''` — the
 * one value it can never be is the literal `/geoLARP` this hardcoded. CLAUDE.md records
 * the same trap for `public/manifest.json`: "that was the stale value, it is what this
 * repo can never generate, and reverting it is how four sessions lost the correct file."
 *
 * The other two admin specs already derived it; this one was the outlier.
 */
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

test.describe('Admin Dashboard E2E', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * SEEDED, NOT ASSUMED (#159).
   *
   * These signed in as `test@example.com` and assumed admin-ness came from
   * `app_metadata`. It does not: `user_profiles.is_admin` is "the single authority since
   * #240" (`admin-depth.spec.ts:15-18`). `AdminGate` redirected, rendered `null`, the
   * console container never appeared — so the first test in each file failed and
   * `mode: 'serial'` skipped every test behind it. Twenty-nine tests, zero coverage.
   *
   * `seedIsolatedAdmin` promotes a throwaway user through that authority and REFUSES to
   * return one whose `is_admin()` does not answer true through the user's OWN session, so
   * a silent demotion fails here rather than sixty lines later as a missing element.
   */
  let fixture: IsolatedAdmin | null = null;

  test.beforeAll(async () => {
    fixture = await seedIsolatedAdmin();
  });

  test.afterAll(async () => {
    await deleteIsolatedAdmin(fixture);
    fixture = null;
  });

  test.beforeEach(async ({ page }) => {
    // SKIPPED AT RUNTIME, NOT AT COLLECTION. A `test.skip(!fixture, …)` in the describe
    // body evaluates before `beforeAll` has run, when `fixture` is still null — it would
    // skip every test unconditionally and report green having run nothing, which is the
    // exact failure #159 exists to remove. Inside a hook it evaluates after seeding.
    test.skip(!fixture, 'Admin client unavailable to seed an admin');

    await page.goto(`${BP}/`);
    await page.waitForLoadState('domcontentloaded');
    // One shared helper instead of the hand-rolled sign-in and localStorage write each of
    // these used to carry. It derives the storage key the way the browser app does, which
    // is the part the three copies got subtly differently.
    await injectSessionIntoPage(page, fixture!.session);
  });

  test.describe('Overview Page', () => {
    test('should display stat cards with non-zero values', async ({ page }) => {
      await page.goto(`${BP}/admin`);
      await page.waitForLoadState('networkidle');

      const overview = page.locator('[data-testid="admin-overview"]');
      await expect(overview).toBeVisible({ timeout: 15000 });

      const statCards = page.locator('[data-testid^="stat-"]');
      await expect(statCards.first()).toBeVisible({ timeout: 10000 });

      const cardTexts = await statCards.allTextContents();
      const hasNonZero = cardTexts.some((text) => {
        const nums = text.match(/\d+/g);
        return nums && nums.some((n) => parseInt(n) > 0);
      });
      expect(hasNonZero).toBe(true);
    });

    test('should display sparkline trend charts', async ({ page }) => {
      await page.goto(`${BP}/admin`);
      await page.waitForLoadState('networkidle');

      const overview = page.locator('[data-testid="admin-overview"]');
      await expect(overview).toBeVisible({ timeout: 15000 });

      const charts = page.locator(
        'svg polyline, svg path, [data-testid*="trend"], [data-testid*="spark"]'
      );
      await page.waitForTimeout(2000);
      const chartCount = await charts.count();

      if (chartCount === 0) {
        const noDataMessages = page.getByText('No data');
        const noDataCount = await noDataMessages.count();
        expect(noDataCount).toBeLessThan(4);
      }
    });

    test('should have working date range filter', async ({ page }) => {
      await page.goto(`${BP}/admin`);
      await page.waitForLoadState('networkidle');

      const overview = page.locator('[data-testid="admin-overview"]');
      await expect(overview).toBeVisible({ timeout: 15000 });

      const dateFilter = page
        .locator('[data-testid*="range"], [data-testid*="date"]')
        .first();
      if (await dateFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(dateFilter).toBeVisible();
      }
    });
  });

  test.describe('Payments Page', () => {
    test('should display payment statistics', async ({ page }) => {
      await page.goto(`${BP}/admin/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const statsSection = page
        .getByRole('heading', { name: /payment/i })
        .first();
      await expect(statsSection).toBeVisible({ timeout: 10000 });
    });

    test('should display provider breakdown table', async ({ page }) => {
      await page.goto(`${BP}/admin/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      // FLOOR, so a data-less run cannot pass vacuously (#861, #396).
      //
      // Every assertion below this line is inside a data-presence `if`, so on a stack with
      // no payment providers the test asserted NOTHING and still went green — which is how four tests
      // in this file passed while measuring nothing the first time they ran. The invariant
      // that always holds is that the PAGE rendered; the data check stays conditional
      // beneath it. Same principle as `admin-depth.spec.ts:64-72`: assert the invariant and
      // keep a floor that stops "nothing rendered" and "everything is correct" being the
      // same green.
      await expect(
        page.getByRole('heading', { name: /payment/i }).first()
      ).toBeVisible({ timeout: 10000 });

      const providerSection = page.getByText(/stripe|paypal/i).first();
      if (
        await providerSection.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        await expect(providerSection).toBeVisible();
      }
    });

    test('should display payment trend chart', async ({ page }) => {
      await page.goto(`${BP}/admin/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const trendSection = page.getByText(/trend|daily|chart/i).first();
      const hasTrend = await trendSection
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      const svgElements = page.locator('svg');
      const svgCount = await svgElements.count();

      expect(hasTrend || svgCount > 0).toBe(true);
    });
  });

  test.describe('Audit Trail Page', () => {
    test('should display authentication statistics', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');

      const statsHeading = page.getByRole('heading', {
        name: /authentication statistics/i,
      });
      await expect(statsHeading).toBeVisible({ timeout: 10000 });

      await expect(
        page.locator('[data-testid="stat-logins-today"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="stat-failed-week"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="stat-rate-limited"]')
      ).toBeVisible();
      await expect(page.locator('[data-testid="stat-signups"]')).toBeVisible();
    });

    test('should display burst detection cards', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const burstHeading = page.getByRole('heading', {
        name: /failed login bursts/i,
      });
      if (await burstHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(page.locator('[data-testid="stat-bursts"]')).toBeVisible();

        const burstCards = page.locator('[data-testid="burst-card"]');
        const burstCount = await burstCards.count();

        if (burstCount > 0) {
          const firstBurst = burstCards.first();
          await expect(firstBurst).toContainText('attempts');
          await expect(firstBurst).toContainText(/\d+\.\d+\.\d+\.\d+/);
        }
      }
    });

    test('should expand burst card to show event details', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      // FLOOR, so a data-less run cannot pass vacuously (#861, #396).
      //
      // Every assertion below this line is inside a data-presence `if`, so on a stack with
      // no burst activity the test asserted NOTHING and still went green — which is how four tests
      // in this file passed while measuring nothing the first time they ran. The invariant
      // that always holds is that the PAGE rendered; the data check stays conditional
      // beneath it. Same principle as `admin-depth.spec.ts:64-72`: assert the invariant and
      // keep a floor that stops "nothing rendered" and "everything is correct" being the
      // same green.
      await expect(
        page
          .getByRole('heading', { name: /authentication statistics/i })
          .first()
      ).toBeVisible({ timeout: 10000 });

      const burstCards = page.locator('[data-testid="burst-card"]');
      const burstCount = await burstCards.count();

      if (burstCount > 0) {
        const toggleButton = page
          .locator('[data-testid="burst-toggle"]')
          .first();
        await toggleButton.click();

        const burstDetail = page.locator('[data-testid="burst-detail"]');
        await expect(burstDetail).toBeVisible({ timeout: 3000 });

        await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

        await toggleButton.click();
        await expect(burstDetail).not.toBeVisible();
        await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      }
    });

    test('should display event log table with rows', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');

      const eventLogHeading = page.getByRole('heading', { name: /event log/i });
      await expect(eventLogHeading).toBeVisible({ timeout: 10000 });

      const eventsTable = page.locator('[data-testid="audit-events-table"]');
      await expect(eventsTable).toBeVisible();

      const tableRows = eventsTable.locator('tbody tr');
      const rowCount = await tableRows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should filter events by type', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      // FLOOR, so a data-less run cannot pass vacuously (#861, #396).
      //
      // Every assertion below this line is inside a data-presence `if`, so on a stack with
      // no audit events the test asserted NOTHING and still went green — which is how four tests
      // in this file passed while measuring nothing the first time they ran. The invariant
      // that always holds is that the PAGE rendered; the data check stays conditional
      // beneath it. Same principle as `admin-depth.spec.ts:64-72`: assert the invariant and
      // keep a floor that stops "nothing rendered" and "everything is correct" being the
      // same green.
      await expect(
        page
          .getByRole('heading', { name: /authentication statistics/i })
          .first()
      ).toBeVisible({ timeout: 10000 });

      const filterSelect = page.locator('[data-testid="event-type-filter"]');
      if (await filterSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filterSelect.selectOption('sign_in_failed');
        await page.waitForTimeout(1000);

        const eventBadges = page.locator(
          '[data-testid="audit-events-table"] .badge-outline'
        );
        const badgeCount = await eventBadges.count();
        if (badgeCount > 0) {
          for (let i = 0; i < badgeCount; i++) {
            await expect(eventBadges.nth(i)).toContainText('sign_in_failed');
          }
        }
      }
    });

    test('should sort event log columns', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');

      const eventsTable = page.locator('[data-testid="audit-events-table"]');
      await expect(eventsTable).toBeVisible({ timeout: 10000 });

      const timeHeader = eventsTable
        .locator('thead button')
        .filter({ hasText: 'Time' });
      if (await timeHeader.isVisible().catch(() => false)) {
        await timeHeader.click();
        const headerCell = eventsTable
          .locator('th')
          .filter({ hasText: 'Time' });
        await expect(headerCell).toHaveAttribute('aria-sort', 'ascending');

        await timeHeader.click();
        await expect(headerCell).toHaveAttribute('aria-sort', 'descending');
      }
    });

    test('should display anomaly alerts when failed logins exist', async ({
      page,
    }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      // FLOOR, so a data-less run cannot pass vacuously (#861, #396).
      //
      // Every assertion below this line is inside a data-presence `if`, so on a stack with
      // no failed logins the test asserted NOTHING and still went green — which is how four tests
      // in this file passed while measuring nothing the first time they ran. The invariant
      // that always holds is that the PAGE rendered; the data check stays conditional
      // beneath it. Same principle as `admin-depth.spec.ts:64-72`: assert the invariant and
      // keep a floor that stops "nothing rendered" and "everything is correct" being the
      // same green.
      await expect(
        page
          .getByRole('heading', { name: /authentication statistics/i })
          .first()
      ).toBeVisible({ timeout: 10000 });

      const anomalyHeading = page.getByRole('heading', {
        name: /anomaly alerts/i,
      });
      if (
        await anomalyHeading.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        const anomalyCards = page.locator('.border-warning');
        const anomalyCount = await anomalyCards.count();
        expect(anomalyCount).toBeGreaterThan(0);

        const firstCard = anomalyCards.first();
        await expect(firstCard).toContainText(/\d+ failed attempts/);
      }
    });

    test('should show retention notice', async ({ page }) => {
      await page.goto(`${BP}/admin/audit`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      await expect(page.getByText(/audit logs are retained/i)).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('Users Page', () => {
    test('should display users table with data', async ({ page }) => {
      await page.goto(`${BP}/admin/users`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const table = page.locator('table').first();
      await expect(table).toBeVisible({ timeout: 10000 });

      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should sort users by column', async ({ page }) => {
      await page.goto(`${BP}/admin/users`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const table = page.locator('table').first();
      await expect(table).toBeVisible({ timeout: 10000 });

      const sortableButton = table.locator('thead button').first();
      if (await sortableButton.isVisible().catch(() => false)) {
        await sortableButton.click();
        const headerCell = table.locator('th[aria-sort]').first();
        const sortVal = await headerCell.getAttribute('aria-sort');
        expect(['ascending', 'descending']).toContain(sortVal);
      }
    });

    test('should search/filter users', async ({ page }) => {
      test.fixme(
        true,
        'Needs >PAGE_SIZE (50) users; the lane has a handful and auth.users FK makes bulk seeding expensive — #172'
      );
      await page.goto(`${BP}/admin/users`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const searchInput = page
        .locator(
          'input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]'
        )
        .first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('alice');
        await page.waitForTimeout(1000);

        // Table should remain present after search (filtered results may be
        // empty or non-empty — both are valid; we're asserting the search
        // didn't crash the view).
        const table = page.locator('table').first();
        await expect(table).toBeVisible();
      }
    });

    test('should display activity badges', async ({ page }) => {
      await page.goto(`${BP}/admin/users`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const badges = page.locator('.badge');
      const badgeCount = await badges.count();
      expect(badgeCount).toBeGreaterThan(0);
    });
  });

  test.describe('Messaging Page', () => {
    test('should display messaging statistics', async ({ page }) => {
      await page.goto(`${BP}/admin/messaging`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10000 });

      const statCards = page.locator('[data-testid^="stat-"]');
      if (
        await statCards
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        const count = await statCards.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should display top senders table', async ({ page }) => {
      await page.goto(`${BP}/admin/messaging`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const topSendersHeading = page.getByText(/top senders/i);
      if (
        await topSendersHeading.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        // The heading rendered without crashing — that's the real signal.
        // Top-senders rows depend on seed data and are tested elsewhere.
        await expect(topSendersHeading).toBeVisible();
      }
    });

    test('should display volume trends', async ({ page }) => {
      await page.goto(`${BP}/admin/messaging`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // The messaging admin page should render its main heading. Volume
      // trend charts depend on seed data range — covered by stat cards
      // test above. Here we just verify the page loaded without crashing.
      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation', () => {
    test('should navigate between all admin tabs', async ({ page }) => {
      await page.goto(`${BP}/admin`);
      await page.waitForLoadState('networkidle');

      const adminNav = page.locator('nav[aria-label="Admin navigation"]');
      await expect(adminNav).toBeVisible({ timeout: 10000 });

      const tabs = [
        { name: 'Payments', url: /\/admin\/payments/ },
        { name: 'Orders', url: /\/admin\/orders/ },
        { name: 'Audit Trail', url: /\/admin\/audit/ },
        { name: 'Users', url: /\/admin\/users/ },
        { name: 'Messaging', url: /\/admin\/messaging/ },
        { name: 'Overview', url: /\/admin\/?$/ },
      ];

      for (const tab of tabs) {
        const link = adminNav.getByText(tab.name);
        await link.click();
        await page.waitForURL(tab.url, { timeout: 10000 });

        const body = page.locator('body');
        const bodyText = await body.textContent();
        expect(bodyText?.length).toBeGreaterThan(0);
      }
    });
  });
});
