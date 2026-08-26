/**
 * The /privacy-controls route must actually pass the two props that close #37.
 *
 * The component-level fix is inert unless the route wires it, and a prop that
 * exists but is never passed reads exactly like one that works. This renders
 * the real page and asserts on the call `clearUserData` receives.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivacyControlsPage from '@/app/privacy-controls/page';
import { STORAGE_KEY } from '@/lib/geolarp/character';

interface ClearOptions {
  keepLocalStorage?: string[];
  keepCookies?: string[];
}

const clearUserData = vi.hoisted(() =>
  vi.fn(async (_options?: ClearOptions) => ({
    success: true,
    clearedItems: [] as string[],
  }))
);

vi.mock('@/utils/privacy', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  clearUserData,
}));

vi.mock('../../src/contexts/ConsentContext', () => ({
  useConsent: () => ({
    consent: { necessary: true, analytics: false, marketing: false },
    isLoading: false,
    openModal: vi.fn(),
    resetConsent: vi.fn(),
    hasConsented: () => true,
  }),
}));

describe('/privacy-controls wires the character key through (#37)', () => {
  beforeEach(() => {
    clearUserData.mockClear();
    window.localStorage.clear();
  });

  it('confirms first, then preserves the character key', async () => {
    const user = userEvent.setup();
    render(<PrivacyControlsPage />);

    const del = await screen.findByRole('button', { name: /delete my data/i });
    await user.click(del);

    // showConfirmation is passed, so the FIRST click must not delete. The
    // component defaults this to false, which is the upstream half of #37.
    expect(clearUserData).not.toHaveBeenCalled();

    const confirm = await screen.findByRole('button', {
      name: /confirm|yes.*delete/i,
    });
    await user.click(confirm);

    expect(clearUserData).toHaveBeenCalledTimes(1);
    const options = clearUserData.mock.calls[0][0];
    expect(options?.keepLocalStorage).toContain(STORAGE_KEY);
    expect(options?.keepLocalStorage).toContain('cookieConsent');
  });
});
