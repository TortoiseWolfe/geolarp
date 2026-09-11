import { test, expect } from '@playwright/test';
import {
  createTestUser,
  deleteTestUser,
  generateTestEmail,
  signInAsInjectable,
  openAuthedPage,
  isAdminClientAvailable,
  type TestUser,
} from '../utils/test-user-factory';

/**
 * Changing a password, against a server that enforces what production enforces (#136).
 *
 * WHY THIS SPEC EXISTS AT ALL. `security_update_password_require_current_password` is live
 * `true`, and `AccountSettings` sent a bare `updateUser({ password })`. Password change was
 * impossible for every user who signed in with a password, and NOTHING caught it: the unit
 * tests could not see the request (the `updateUser` spy was rebuilt inside the client
 * factory on every call), and the local lane ran gotrue v2.177.0, in which
 * `current_password` does not exist at all — it would have been dropped as an unknown JSON
 * key and the test would have passed having proven nothing.
 *
 * Both of those are fixed, so this can finally be a real test: the image is pinned at
 * v2.196.0 to match production, and `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD`
 * is set here too.
 *
 * THE SESSION SHAPE IS THE POINT, AND IT IS THE ONE PRODUCTION COULD NOT BE PROBED FOR.
 * gotrue exempts "recovery" sessions from the current-password check — `IsRecovery()` is
 * true for AMR `otp`, `magiclink` and `recovery` (`internal/models/factor.go:62`). So a
 * magic-link session can already change a password with a bare `{ password }`, and testing
 * through one proves nothing about the defect.
 *
 * `signInAsInjectable` uses `signInWithPassword`, which records AMR `password` — NOT in
 * that exempt set. That is exactly the shape real users have and the one that was broken.
 * It cannot be probed against the hosted project because `/token` is CAPTCHA-wrapped
 * (`api.go:268`) and Turnstile withholds tokens from automation by design; locally there is
 * no captcha, so this lane is the only place the real branch can be exercised.
 *
 * ASSERTIONS ARE ON BEHAVIOUR, NOT ON gotrue's PROSE. Its text for a MISSING and a WRONG
 * current password is byte-identical (`user.go:177` and `:184`); only the error code
 * separates them, and the app's own copy is what a user reads.
 */

const BP = process.env.E2E_PATH_PREFIX ?? '';
const OLD_PASSWORD = 'OldPassword123!';
const NEW_PASSWORD = 'NewPassword456!';

test.describe('Password change', () => {
  // Skipped only where the stack genuinely cannot host it — the same shape
  // `admin-depth.spec.ts` uses, and deliberately NOT keyed on `CI` (#152).
  test.skip(
    !isAdminClientAvailable(),
    'Needs the admin client to seed a throwaway user'
  );

  // Each test owns its user. The shared PRIMARY fixture must never be used here:
  // changing its password poisons `auth.setup.ts` for every later shard.
  let user: TestUser | null = null;

  test.afterEach(async () => {
    if (user) {
      await deleteTestUser(user.id);
      user = null;
    }
  });

  async function seedAndOpen(browser: Parameters<typeof openAuthedPage>[0]) {
    user = await createTestUser(generateTestEmail('pwchange'), OLD_PASSWORD, {
      createProfile: true,
    });
    expect(user, 'seeding a throwaway user').not.toBeNull();

    const { session, error } = await signInAsInjectable(
      user!.email,
      OLD_PASSWORD
    );
    expect(error, 'signing in with a password').toBeNull();
    expect(session, 'a password-grant session').not.toBeNull();

    const opened = await openAuthedPage(browser, session!);
    await opened.page.goto(`${BP}/account`);
    await opened.page.waitForLoadState('networkidle');

    // PROVE WE LANDED BEFORE MEASURING ANYTHING. `/account` sits behind
    // `ProtectedRoute`, which renders nothing for an unauthenticated visitor — so
    // without this, a session that failed to inject would leave every assertion below
    // timing out against an empty page and reporting the wrong cause. This is the
    // `admin-depth.spec.ts:36-42` rule, and #454 is what it costs to skip it.
    await expect(
      opened.page.getByRole('heading', { name: 'Change Password' }),
      'ProtectedRoute should have let the injected session through to /account'
    ).toBeVisible({ timeout: 15000 });

    return opened;
  }

  const fill = async (
    page: import('@playwright/test').Page,
    current: string,
    next = NEW_PASSWORD
  ) => {
    await page.fill('#current-password-input', current);
    await page.fill('#new-password-input', next);
    await page.fill('#confirm-password-input', next);
    await page.getByRole('button', { name: 'Change Password' }).click();
  };

  test('succeeds with the correct current password, and the new one signs in', async ({
    browser,
  }) => {
    const opened = await seedAndOpen(browser);
    try {
      await fill(opened.page, OLD_PASSWORD);
      await expect(
        opened.page.getByText('Password changed successfully!')
      ).toBeVisible({ timeout: 15000 });

      // The real assertion. A success banner is the app's opinion; signing in with the
      // new password is the server's, and only the second one proves the write landed.
      const after = await signInAsInjectable(user!.email, NEW_PASSWORD);
      expect(after.error, 'new password should authenticate').toBeNull();
      expect(after.session).not.toBeNull();

      const stale = await signInAsInjectable(user!.email, OLD_PASSWORD);
      expect(stale.session, 'old password must stop working').toBeNull();
    } finally {
      await opened.close();
    }
  });

  test('is rejected when the current password is wrong, and the old one still works', async ({
    browser,
  }) => {
    const opened = await seedAndOpen(browser);
    try {
      await fill(opened.page, 'NotThePassword123!');
      await expect(
        opened.page.getByText('That is not your current password.')
      ).toBeVisible({ timeout: 15000 });

      // Distinct copy from the missing-password case below. gotrue's own message is
      // identical for both, so if these two ever render the same text the mapping has
      // regressed to reading `error.message`.
      await expect(
        opened.page.getByText('Enter your current password to change it.')
      ).toHaveCount(0);

      const stale = await signInAsInjectable(user!.email, OLD_PASSWORD);
      expect(
        stale.error,
        'a rejected change must not alter the password'
      ).toBeNull();
    } finally {
      await opened.close();
    }
  });

  test('asks for the current password before contacting the server', async ({
    browser,
  }) => {
    const opened = await seedAndOpen(browser);
    try {
      await fill(opened.page, '');
      await expect(
        opened.page.getByText('Enter your current password to change it.')
      ).toBeVisible({ timeout: 15000 });

      const stale = await signInAsInjectable(user!.email, OLD_PASSWORD);
      expect(stale.error).toBeNull();
    } finally {
      await opened.close();
    }
  });

  /**
   * THE NEGATIVE CONTROL FOR THE WHOLE FILE.
   *
   * If the server were NOT enforcing `require_current_password` — the old gotrue, or the
   * flag unset — a bare `{ password }` would succeed and every test above would still
   * pass, because they all send a current password. This one sends none, straight to the
   * API, and requires a rejection. Without it the suite cannot tell a fixed app from an
   * unenforcing server.
   */
  test('the server itself rejects a bare password update', async ({
    browser,
  }) => {
    const opened = await seedAndOpen(browser);
    try {
      const supabaseUrl =
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
      expect(anonKey, 'anon key must reach the test process').not.toBe('');

      // Straight to the API with the session the page already holds — no app code in
      // the way, so this measures the SERVER's rule rather than the client's.
      const result = await opened.page.evaluate(
        async ({ url, key }) => {
          const storageKey = Object.keys(localStorage).find((k) =>
            k.startsWith('sb-')
          );
          if (!storageKey)
            return { status: 0, errorCode: 'no-session-in-storage' };
          const token = JSON.parse(
            localStorage.getItem(storageKey) as string
          ).access_token;
          const res = await fetch(`${url}/auth/v1/user`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              apikey: key,
            },
            body: JSON.stringify({ password: 'BareAttempt123!' }),
          });
          const body = (await res.json().catch(() => null)) as {
            error_code?: string;
          } | null;
          return { status: res.status, errorCode: body?.error_code ?? null };
        },
        { url: supabaseUrl, key: anonKey }
      );

      expect(
        result.status,
        'a bare {password} must be REJECTED. If this succeeds, the server is not ' +
          'enforcing require_current_password — because the flag is unset or the image ' +
          'predates the field — and every other test in this file is vacuous: they all ' +
          'send a current password, so they would pass either way.'
      ).toBe(400);
      expect(result.errorCode).toBe('current_password_required');

      const stale = await signInAsInjectable(user!.email, OLD_PASSWORD);
      expect(
        stale.error,
        'the rejected attempt must not have changed anything'
      ).toBeNull();
    } finally {
      await opened.close();
    }
  });
});
