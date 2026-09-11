/**
 * E2E Test: Admin Conversation List
 *
 * Asserts the per-conversation metadata table on /admin/messaging:
 *   1. Column headers render (Conversation, Participants, Messages,
 *      Last activity, Created).
 *   2. Rows with last_activity older than STALE_THRESHOLD_MS carry the
 *      stale badge; fresh rows do not.
 *
 * The stale case is guaranteed by seeding a conversation with
 * last_message_at = now() - 45 days in beforeAll. The demo seed
 * (88888888-... rows) has nothing older than ~12 days, so without
 * this insert the stale assertion would be dead weight.
 *
 * Run from inside the Docker container:
 *   docker compose exec -T -e SKIP_WEBSERVER=1 -e CI= geolarp \
 *     pnpm exec playwright test tests/e2e/admin/admin-conversation-list.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  seedIsolatedAdmin,
  deleteIsolatedAdmin,
  injectSessionIntoPage,
  type IsolatedAdmin,
} from '../utils/test-user-factory';
import { STALE_THRESHOLD_MS } from '../../../src/components/organisms/AdminConversationList/AdminConversationList';

const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Local-only spec (skipped in CI). The Node test process reaches local Kong via
// SUPABASE_ADMIN_URL (compose-internal supabase-kong:8000); the browser reaches
// it via NEXT_PUBLIC_SUPABASE_URL (host.docker.internal:54321). No proxy /
// --host-resolver-rules hack needed — see #121.
const SUPABASE_ADMIN_URL =
  process.env.SUPABASE_ADMIN_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Seed placed safely past the threshold. Using STALE_THRESHOLD_MS * 1.5
// rather than a hardcoded "45 days" means raising the threshold in the
// component can't silently turn this spec into a no-op.
const STALE_LAST_MESSAGE = new Date(
  Date.now() - STALE_THRESHOLD_MS * 1.5
).toISOString();

// Stable UUID so reruns clean up their own mess. v4-shaped (version nibble
// = 4, variant nibble = a) in case anything downstream validates format.
const STALE_CONV_ID = 'eeeeeeee-eeee-4eee-aeee-000000000e2e';

test.describe('Admin Conversation List E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let serviceClient: SupabaseClient;

  /**
   * SEEDED, NOT ASSUMED (#159). This signed in as `test@example.com` and assumed
   * admin-ness came from `app_metadata`; `user_profiles.is_admin` is "the single authority
   * since #240" (`admin-depth.spec.ts:15-18`). `AdminGate` redirected and the list
   * container never rendered.
   */
  let fixture: IsolatedAdmin | null = null;

  test.beforeAll(async () => {
    // Supabase seeding can exceed the default 30s on a cold local stack.
    test.setTimeout(60000);

    fixture = await seedIsolatedAdmin();

    // Seed the stale conversation. service_role bypasses RLS; conversations
    // RLS is participant-only and the test process is neither participant.
    serviceClient = createClient(SUPABASE_ADMIN_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Borrow two existing profile IDs — the check_group_participants
    // constraint (migration:1253) requires both participant columns NOT NULL
    // for is_group=FALSE. Which two doesn't matter; admin_conversation_list
    // never selects participant columns.
    //
    // canonical_ordering (migration:1607) enforces p1 < p2. .limit(2) alone
    // returns insertion order which may violate that, and .order('id') on a
    // UUID column sorts lexically not by bytea — so sort client-side where
    // string comparison matches what Postgres's uuid < does.
    const { data: profiles, error: profileErr } = await serviceClient
      .from('user_profiles')
      .select('id')
      .limit(2);
    if (profileErr || !profiles || profiles.length < 2) {
      throw new Error(
        `Need ≥2 user_profiles to satisfy the participant constraint: ${profileErr?.message ?? 'not enough rows'}`
      );
    }
    const [p1, p2] = [profiles[0].id, profiles[1].id].sort();

    // Delete-then-insert: upsert would need a conflict target and there's no
    // unique constraint on id alone to name. A prior run that crashed before
    // afterAll would otherwise 23505 here.
    await serviceClient.from('conversations').delete().eq('id', STALE_CONV_ID);
    const { error: insertErr } = await serviceClient
      .from('conversations')
      .insert({
        id: STALE_CONV_ID,
        participant_1_id: p1,
        participant_2_id: p2,
        is_group: false,
        last_message_at: STALE_LAST_MESSAGE,
        // created_at must predate last_message_at or the row is nonsensical
        // (and admin_conversation_list's COALESCE would pick created_at for
        // a NULL last_message_at, making the seed order-sensitive).
        created_at: STALE_LAST_MESSAGE,
      });
    if (insertErr) {
      throw new Error(
        `Failed to seed stale conversation: ${insertErr.message}`
      );
    }
  });

  test.afterAll(async () => {
    await serviceClient?.from('conversations').delete().eq('id', STALE_CONV_ID);
    await deleteIsolatedAdmin(fixture);
    fixture = null;
  });

  test.beforeEach(async ({ page }) => {
    // Runtime, not collection: a `test.skip(!fixture, …)` in the describe body runs
    // before `beforeAll` has seeded, so it would skip everything and report green
    // having run nothing — the exact shape #159 exists to remove.
    test.skip(!fixture, 'Admin client unavailable to seed an admin');

    await page.goto(`${BP}/`);
    await page.waitForLoadState('domcontentloaded');
    await injectSessionIntoPage(page, fixture!.session);

    // The admin route itself. Dropped when this beforeEach was rewritten for #159, which
    // left every test measuring the HOME page — and the failure read as "the container is
    // missing" rather than "we never went there". Exactly the #454 shape, self-inflicted.
    await page.goto(`${BP}/admin/messaging`);
    await page.waitForLoadState('networkidle');
  });

  test('renders all five metadata column headers', async ({ page }) => {
    const list = page.locator('[data-testid="admin-conversation-list"]');
    await expect(list).toBeVisible({ timeout: 15000 });

    const table = page.locator('[data-testid="admin-conversation-list-table"]');
    await expect(table).toBeVisible({ timeout: 10000 });

    // AdminDataTable renders column labels as <th>. Querying by role is more
    // resilient than by text — if a label changes the failure points at the
    // table, not at a stale string match.
    const headers = table.getByRole('columnheader');
    await expect(headers).toHaveCount(5);

    // Spot-check the labels. These are the column defs at
    // AdminConversationList.tsx:85-137 — if someone reorders or renames,
    // this is where they find out.
    await expect(
      table.getByRole('columnheader', { name: /^Conversation$/ })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: /Participants/ })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: /Messages/ })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: /Last activity/ })
    ).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: /Created/ })
    ).toBeVisible();
  });

  test('flags the seeded >30d conversation as stale, leaves fresh rows unflagged', async ({
    page,
  }) => {
    const table = page.locator('[data-testid="admin-conversation-list-table"]');
    await expect(table).toBeVisible({ timeout: 15000 });

    // admin_conversation_list sorts by last_activity DESC, so the 45-day-old
    // seed lands at the bottom. CONVERSATION_PAGE_SIZE is 50 and the DB has
    // ~6 conversations total — everything fits on page 1.
    const staleCell = table
      .locator(`[data-stale="true"]`)
      .filter({ has: page.getByText('stale') });
    await expect(staleCell).toHaveCount(1);

    // The stale cell's row contains the seeded ID's truncation. This ties
    // the badge to the specific row we planted, not just "some row has it".
    const staleRow = staleCell.locator('xpath=ancestor::tr');
    await expect(staleRow).toContainText(STALE_CONV_ID.slice(0, 8));

    // And the converse — the demo seed's freshest row (88888888-...801 at
    // ~yesterday) carries data-stale=false and NO badge. If the component
    // ever flips to >= or the threshold math drifts, one of these two
    // assertions catches it.
    const freshCells = table.locator(`[data-stale="false"]`);
    const freshCount = await freshCells.count();
    expect(freshCount).toBeGreaterThan(0);
    for (let i = 0; i < freshCount; i++) {
      await expect(freshCells.nth(i).getByText('stale')).toHaveCount(0);
    }
  });
});
