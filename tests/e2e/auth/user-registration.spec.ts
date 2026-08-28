/**
 * E2E Test: User Registration Flow (T066)
 *
 * Tests the complete registration journey from quickstart.md:
 * sign-up → verify email → sign-in → access protected pages
 *
 * Email domain is derived from TEST_USER_PRIMARY_EMAIL.
 */

import { test, expect } from '@playwright/test';
import {
  dismissCookieBanner,
  DEFAULT_TEST_PASSWORD,
  signOutViaDropdown,
} from '../utils/test-user-factory';

/**
 * Generate a test email for registration tests.
 * Derives domain from TEST_USER_PRIMARY_EMAIL to ensure valid emails.
 */
function generateRegistrationEmail(prefix: string): string {
  const baseEmail = process.env.TEST_USER_PRIMARY_EMAIL || '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  // Derive domain from primary test user
  if (baseEmail.includes('@gmail.com')) {
    const baseUser = baseEmail.split('+')[0] || baseEmail.split('@')[0];
    return `${baseUser}+reg-${prefix}-${timestamp}-${random}@gmail.com`;
  }

  const domain = baseEmail.split('@')[1] || 'example.com';
  return `reg-${prefix}-${timestamp}-${random}@${domain}`;
}

test.describe('User Registration E2E', () => {
  const testEmail = generateRegistrationEmail('main');
  const testPassword = DEFAULT_TEST_PASSWORD;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);
  });

  // Skip: Requires real Supabase user creation - run with proper env setup
  test.skip('should complete full registration flow from sign-up to protected access', async ({
    page,
  }) => {
    // Step 1: Navigate to sign-up page
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/sign-up\/?$/);
    await expect(
      page.getByRole('heading', { name: 'Create Account' })
    ).toBeVisible();

    // Step 2: Fill sign-up form
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);

    // Step 3: Check Remember Me (optional)
    await page.getByLabel('Remember Me').check();

    // Step 4: Submit sign-up form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Step 5: Verify redirected to verify-email or profile
    // Note: In development, email verification might be disabled
    await page.waitForURL(/\/(verify-email|profile)/);

    // Step 6: If on verify-email page, check for verification notice
    if (page.url().includes('verify-email')) {
      await expect(page.getByText(/check your inbox/i)).toBeVisible();

      // In real scenario, user would click link in email
      // For E2E test, we can skip to profile if email verification is disabled
    }

    // Step 7: Navigate to profile (protected route)
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });

    // Step 8: Verify user is authenticated and can access profile
    await expect(page.getByText(testEmail)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

    // Step 9: Verify payment demo access (another protected route)
    await page.goto('/payment-demo', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/payment-demo\/?$/);
    await expect(
      page.getByRole('heading', { name: 'Payment Integration Demo' })
    ).toBeVisible();

    // Step 10: Sign out via dropdown menu
    await signOutViaDropdown(page);

    // Step 11: Verify redirected to home then can access sign-in
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL('/sign-in');

    // Clean up: Delete test user (would need admin API or manual cleanup)
  });

  test('should show validation errors for invalid TLD email', async ({
    page,
  }) => {
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Fill with email that has invalid TLD (passes browser validation, fails our TLD check)
    // Browser validates format, our validator checks TLD against allowed list
    await page.getByLabel('Email').fill('test@example.xyz123');
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown (invalid TLD not in allowed list)
    await expect(page.getByText(/invalid.*domain/i)).toBeVisible();
  });

  test('should show validation errors for weak password', async ({ page }) => {
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Fill with weak password
    const weakEmail = generateRegistrationEmail('weak-pass');
    await page.getByLabel('Email').fill(weakEmail);
    await page.getByLabel('Password', { exact: true }).fill('weak');
    await page.getByLabel('Confirm Password').fill('weak');

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(
      page.getByText(/password must be at least 8 characters/i)
    ).toBeVisible();
  });

  test('should show error for password mismatch', async ({ page }) => {
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Fill with mismatched passwords
    const mismatchEmail = generateRegistrationEmail('mismatch');
    await page.getByLabel('Email').fill(mismatchEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill('DifferentPass123!');

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should navigate to sign-in from sign-up page', async ({ page }) => {
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    // Click sign-in link in the "Already have an account?" section (not the header link)
    // Use locator that targets the link after the specific text
    await page
      .locator('text=Already have an account?')
      .locator('..')
      .getByRole('link')
      .click();

    // Verify navigated to sign-in (with optional trailing slash)
    await expect(page).toHaveURL(/\/sign-in\/?/);
  });

  test('the OAuth section is present only when a provider is configured', async ({
    page,
  }) => {
    await page.goto('/sign-up', { waitUntil: 'domcontentloaded' });
    await dismissCookieBanner(page);

    /*
      THE OAUTH SECTION MUST AGREE WITH ITSELF (#9).

      This used to assert the GitHub and Google buttons were visible — an
      assertion about markup that said nothing about whether pressing one could
      work. It passed for months while the live project had
      `external_github_enabled: false` and `external_google_enabled: false`, so
      every press failed at the provider.

      The buttons now render only for providers this build has configured, which
      in CI is none. Asserting "zero buttons" would be just as brittle in the
      other direction — it would fail the day someone legitimately enables one.

      So this asserts the INVARIANT that holds either way: the "or" rule and the
      buttons appear together or not at all. It fails if the gating regresses in
      either direction, and it is the specific defect the change introduced a
      risk of — hiding the buttons while leaving a rule labelled "or" with
      nothing under it.
    */
    const buttons = page
      .locator('button')
      .filter({ hasText: /continue with/i });
    const divider = page.locator('.divider').filter({ hasText: /^\s*or\s*$/i });

    const buttonCount = await buttons.count();
    const dividerCount = await divider.count();

    if (buttonCount === 0) {
      expect(
        dividerCount,
        'an "or" divider is rendered with no OAuth buttons beneath it'
      ).toBe(0);
    } else {
      expect(
        dividerCount,
        'OAuth buttons are rendered with no "or" divider above them'
      ).toBeGreaterThan(0);
      // Every rendered button must name a provider rather than be a stub.
      await expect(buttons.first()).toBeVisible();
      expect(await buttons.first().innerText()).toMatch(/github|google/i);
    }
  });
});
