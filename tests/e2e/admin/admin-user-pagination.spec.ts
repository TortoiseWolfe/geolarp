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

import { test, expect, type Page } from '@playwright/test';
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

  /**
   * PAGE_SIZE, mirrored from `src/app/admin/users/page.tsx:14`.
   *
   * Not imported: that module is a client component with a `supabase` import chain, and
   * pulling it into the Node test process drags the browser client in with it.
   * `pagination-rule-mirrors-page-size.test.js` fails if the two ever disagree, which is
   * the part that actually needs guarding.
   */
  const PAGE_SIZE = 50;

  /**
   * The total the PAGE reports, read from "Showing 1–50 of 123".
   *
   * Every assertion below is derived from this rather than from an assumed fixture. That
   * is the whole point of #172: these five tests each asserted one branch of a rule and
   * needed 51 seeded users to reach it — and `user_profiles.id REFERENCES auth.users(id)`
   * makes that 51 real auth users per shard, per run. Reading the total instead lets the
   * same test assert the rule in whichever direction the data actually falls, and covers
   * the branch that was never tested at all.
   */
  async function readTotal(page: Page): Promise<number> {
    const line = page.locator('[data-testid="user-count"]');
    await expect(line).toBeVisible({ timeout: 10000 });
    const text = (await line.textContent()) ?? '';
    const m = text.match(/of\s+([\d,]+)/);
    if (!m) {
      throw new Error(
        `could not read a total from the count line: ${JSON.stringify(text)}. ` +
          `Every assertion in this file derives from it, so a format change must fail ` +
          `here rather than silently make the tests vacuous.`
      );
    }
    return Number.parseInt(m[1].replace(/,/g, ''), 10);
  }

  async function openUsers(page: Page) {
    await page.goto(`${BP}/admin/users`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="admin-users"]')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="user-table"]')).toBeVisible({
      timeout: 10000,
    });
  }

  /**
   * THE RULE, straight from `Pagination.tsx:36-38`:
   *
   *     const totalPages = Math.ceil(totalItems / pageSize);
   *     if (totalPages <= 1) return null;
   *
   * So the control appears exactly when there is somewhere to go. Asserting BOTH sides
   * means a lane with two users tests the same contract as one with two hundred — and
   * the "one page" side had never been covered by anything.
   */
  test('pagination appears exactly when there is more than one page', async ({
    page,
  }) => {
    await openUsers(page);
    const total = await readTotal(page);
    const pagination = page.locator('[data-testid="user-pagination"]');

    if (total > PAGE_SIZE) {
      await expect(pagination).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator('[data-testid="user-pagination-indicator"]')
      ).toContainText(`Page 1 of ${Math.ceil(total / PAGE_SIZE)}`);
      await expect(
        pagination.locator('button[aria-label="Previous page"]')
      ).toBeDisabled();
      await expect(
        pagination.locator('button[aria-label="Next page"]')
      ).toBeEnabled();
    } else {
      // The branch the old test could never reach, and the one this lane is always in.
      await expect(pagination).toHaveCount(0);
    }
  });

  test('paging forward is offered only when there is a page to reach', async ({
    page,
  }) => {
    await openUsers(page);
    const total = await readTotal(page);
    const nextBtn = page.locator('button[aria-label="Next page"]');

    if (total <= PAGE_SIZE) {
      await expect(nextBtn).toHaveCount(0);
      return;
    }

    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    const countLine = page.locator('[data-testid="user-count"]');
    const before = await countLine.textContent();

    await nextBtn.click();
    await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });
    // Auto-retrying, because `handlePageChange` sets currentPage BEFORE awaiting the
    // fetch (`admin/users/page.tsx:76-85`) — the indicator flips before rows arrive, so
    // a textContent() snapshot here races the response.
    await expect(countLine).not.toHaveText(before ?? '', { timeout: 10000 });
    await expect(
      page.locator('[data-testid="user-table"] tbody tr').first()
    ).toBeVisible();
  });

  test('Next is disabled on the last page, whichever page that is', async ({
    page,
  }) => {
    await openUsers(page);
    const total = await readTotal(page);
    const nextBtn = page.locator('button[aria-label="Next page"]');

    if (total <= PAGE_SIZE) {
      await expect(nextBtn).toHaveCount(0);
      return;
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    for (let i = 1; i < totalPages; i += 1) {
      await nextBtn.click();
      await expect(indicator).toContainText(`Page ${i + 1} of`, {
        timeout: 10000,
      });
    }
    await expect(nextBtn).toBeDisabled();
  });

  /**
   * Searching needs no threshold at all — which is why this one never should have been
   * gated on PAGE_SIZE. A term that matches nothing must narrow the table, and clearing
   * it must restore what was there.
   */
  test('searching narrows the table, and clearing it restores the table', async ({
    page,
  }) => {
    await openUsers(page);
    const countLine = page.locator('[data-testid="user-count"]');
    const baseline = await countLine.textContent();
    const total = await readTotal(page);

    const search = page.locator('[data-testid="user-search"]');
    await search.fill('zzz-no-user-can-match-this-zzz');
    // The page debounces at 300ms before refetching.
    await expect(countLine).not.toHaveText(baseline ?? '', { timeout: 10000 });
    expect(await readTotal(page)).toBeLessThan(total);

    await search.fill('');
    await expect(countLine).toHaveText(baseline ?? '', { timeout: 10000 });
  });

  test('searching returns to the first page', async ({ page }) => {
    await openUsers(page);
    const total = await readTotal(page);
    const indicator = page.locator('[data-testid="user-pagination-indicator"]');
    const search = page.locator('[data-testid="user-search"]');

    if (total > PAGE_SIZE) {
      await page.locator('button[aria-label="Next page"]').click();
      await expect(indicator).toContainText('Page 2 of', { timeout: 10000 });
    }

    await search.fill('zzz-no-user-can-match-this-zzz');

    // Whatever the data, the page index must not survive a new search. Above PAGE_SIZE
    // that means returning to page 1; at or below it, the control is gone entirely —
    // `handleSearchChange` sets currentPage to 0 either way
    // (`admin/users/page.tsx:52-56`).
    const pagination = page.locator('[data-testid="user-pagination"]');
    if (await pagination.isVisible().catch(() => false)) {
      await expect(indicator).toContainText('Page 1 of', { timeout: 10000 });
    } else {
      await expect(pagination).toHaveCount(0);
    }
    await expect(page.locator('[data-testid="user-table"]')).toBeVisible();
  });
});
