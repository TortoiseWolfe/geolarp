/**
 * E2E Test: Admin User Pagination
 *
 * Tests the pagination controls on the admin Users page:
 * 1. Pagination visible when users exceed PAGE_SIZE
 * 2. Navigate to page 2 — table rows and range text update
 * 3. Search resets page back to 1
 * 4. Next button disabled on last page
 *
 * Requires: local Supabase with seed-admin-demo.sql applied (50+ users),
 * admin user test@example.com with is_admin app_metadata.
 *
 * Run from inside the Docker container:
 *   docker exec -e SKIP_WEBSERVER=1 -e BASE_URL=http://localhost:3000 \
 *     geolarp-geolarp-1 npx playwright test tests/e2e/admin/admin-user-pagination.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import {
  seedIsolatedAdmin,
  deleteIsolatedAdmin,
  injectSessionIntoPage,
  type IsolatedAdmin,
} from '../utils/test-user-factory';

// Next.js basePath — empty in local dev, '/geoLARP' in CI/prod
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

test.describe('Admin User Pagination E2E', () => {
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

  test('should display pagination when more than PAGE_SIZE users exist', async ({
    page,
  }) => {
    test.fixme(
      true,
      '/admin/users errors and the page discards the reason (#169); needs seeded users (#168 first)'
    );
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const container = page.locator('[data-testid="admin-users"]');
    await expect(container).toBeVisible({ timeout: 15000 });

    // Wait for table to load
    const table = page.locator('[data-testid="user-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Pagination should be visible (seed data has 50+ users)
    const pagination = page.locator('[data-testid="user-pagination"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });

    // Page indicator shows "Page 1 of N"
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    await expect(indicator).toContainText('Page 1 of');

    // Previous disabled on first page
    const prevBtn = pagination.locator('button[aria-label="Previous page"]');
    await expect(prevBtn).toBeDisabled();

    // Next enabled (there are more pages)
    const nextBtn = pagination.locator('button[aria-label="Next page"]');
    await expect(nextBtn).toBeEnabled();
  });

  test('should navigate to page 2 and update table rows', async ({ page }) => {
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('[data-testid="user-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Capture page 1 state
    const page1Count = page.locator('[data-testid="user-count"]');
    const page1CountText = await page1Count.textContent();

    // Click Next
    const nextBtn = page.locator('button[aria-label="Next page"]');
    await nextBtn.click();

    // Wait for indicator to update
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });

    // Range text should update (e.g., "Showing 51–100 of ...")
    await expect(page1Count).not.toHaveText(page1CountText || '');

    // Table still has rows
    const page2Rows = table.locator('tbody tr');
    const rowCount = await page2Rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should search users and reset to page 1', async ({ page }) => {
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('[data-testid="user-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Navigate to page 2 first
    const nextBtn = page.locator('button[aria-label="Next page"]');
    const pagination = page.locator('[data-testid="user-pagination"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });
    await nextBtn.click();

    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });

    // Now search — should reset to page 1
    const searchInput = page.locator('[data-testid="user-search"]');
    await searchInput.fill('alice');

    // Wait for debounce (300ms) + network
    await page.waitForTimeout(500);

    // Page should reset — either back to "Page 1 of" or pagination hidden (results fit one page)
    const paginationStillVisible = await pagination
      .isVisible()
      .catch(() => false);
    if (paginationStillVisible) {
      await expect(indicator).toContainText('Page 1 of');
    }

    // Table should still be present after search (results may be empty or
    // filtered — both are valid; the real assertion is the page-reset above).
    await expect(table).toBeVisible();
  });

  test('should search, page forward, and confirm results update at each step', async ({
    page,
  }) => {
    // Single-flow test: three state captures, two transitions. Searching and
    // paging are independent code paths (handleSearchChange vs handlePageChange
    // in admin/users/page.tsx) — this asserts both drive the table without
    // having to assume the seed has 51+ rows sharing a search substring.
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('[data-testid="user-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('[data-testid="user-search"]');
    const countLine = page.locator('[data-testid="user-count"]');
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    const pagination = page.locator('[data-testid="user-pagination"]');
    const nextBtn = page.locator('button[aria-label="Next page"]');
    const firstRow = table.locator('tbody tr').first();

    // --- State 0: unfiltered page 1 -----------------------------------------
    await expect(pagination).toBeVisible({ timeout: 5000 });
    await expect(indicator).toContainText('Page 1 of');
    const baselineCount = await countLine.textContent();
    const baselineFirstRow = await firstRow.textContent();
    expect(baselineCount).toBeTruthy();
    expect(baselineFirstRow).toBeTruthy();

    // --- Transition 1: search -----------------------------------------------
    // admin_list_users at migration:872-873 searches username OR display_name
    // via ILIKE. Seed has only testadmin + testuser-b with non-null values;
    // admin_list_users filters is_admin=FALSE so 'test' narrows to ≤1 row.
    await searchInput.fill('test');
    // Wait for the count line to change — debounce is 300ms, but polling on
    // the mutated DOM is more honest than a fixed timeout.
    await expect(countLine).not.toHaveText(baselineCount ?? '', {
      timeout: 5000,
    });

    // --- State 1: filtered --------------------------------------------------
    // Results now fit one page — Pagination returns null when totalPages ≤ 1.
    await expect(pagination).not.toBeVisible();
    const filteredCount = await countLine.textContent();
    expect(filteredCount).not.toBe(baselineCount);

    // --- Transition 2: clear + page forward ---------------------------------
    await searchInput.fill('');
    // Back to unfiltered — count line returns to baseline.
    await expect(countLine).toHaveText(baselineCount ?? '', { timeout: 5000 });
    await expect(pagination).toBeVisible();
    await nextBtn.click();

    // --- State 2: page 2 ----------------------------------------------------
    await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });
    // handlePageChange sets currentPage THEN awaits the fetch THEN setUsers
    // (admin/users/page.tsx:76-85). The indicator is derived from currentPage
    // so it flips to "Page 2" before rows arrive. A .textContent() snapshot
    // here races the fetch; the auto-retrying not.toHaveText polls until
    // setUsers re-renders the tbody — proof the server actually answered.
    await expect(firstRow).not.toHaveText(baselineFirstRow ?? '', {
      timeout: 10000,
    });
  });

  test('should disable Next on last page', async ({ page }) => {
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');

    const pagination = page.locator('[data-testid="user-pagination"]');
    await expect(pagination).toBeVisible({ timeout: 10000 });

    // Read total pages from indicator text "Page 1 of N"
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    const indicatorText = await indicator.textContent();
    const match = indicatorText?.match(/Page \d+ of (\d+)/);
    const totalPages = match ? parseInt(match[1], 10) : 1;

    // Navigate to the last page
    const nextBtn = page.locator('button[aria-label="Next page"]');
    for (let i = 1; i < totalPages; i++) {
      await nextBtn.click();
      // Wait for page indicator to update instead of blind sleep
      await expect(indicator).toContainText(`Page ${i + 1} of`, {
        timeout: 10000,
      });
    }

    // Verify we're on the last page
    await expect(indicator).toContainText(
      `Page ${totalPages} of ${totalPages}`
    );

    // Next should be disabled
    await expect(nextBtn).toBeDisabled();

    // Previous should be enabled (unless there's only 1 page, but we wouldn't be here)
    const prevBtn = pagination.locator('button[aria-label="Previous page"]');
    await expect(prevBtn).toBeEnabled();
  });
});
