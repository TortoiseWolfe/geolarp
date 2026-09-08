/**
 * /pricing must not advertise a Buy button when nothing can take money (#102).
 *
 * WHY THIS IS A UNIT TEST AND NOT AN E2E. Both E2E lanes inject
 * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_e2e_dummy_not_a_real_key`
 * (e2e-local.yml:335, e2e.yml:252/442), so `stripeEnabled` is ALWAYS true in
 * CI. `tests/e2e/commerce/pricing-links.spec.ts` therefore measures the
 * configured path and structurally cannot reach the other one — the same shape
 * as the mobile sweep, which records that the "not configured" panel is one
 * "CI never shows". Production is the only place the gated state renders, and
 * nothing was looking at it. This is what looks at it.
 *
 * Both directions are asserted from one file via `vi.resetModules()` +
 * `vi.doMock`, because the page derives `noPaymentProviders` once at module
 * scope — a single static mock could only ever test one of them.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

type Flags = { stripeEnabled: boolean; paypalEnabled: boolean };

async function renderPricing(flags: Flags) {
  vi.resetModules();
  vi.doMock('@/config/payment', () => ({
    featureFlags: {
      ...flags,
      cashAppEnabled: false,
      chimeEnabled: false,
    },
  }));
  const { default: PricingPage } = await import('@/app/pricing/page');
  render(<PricingPage />);
}

/** Buy actions, however the href ends up spelled (trailingSlash, basePath). */
const buyLinks = () =>
  Array.from(document.querySelectorAll('a[href*="checkout"]')).filter((a) =>
    (a.getAttribute('href') ?? '').includes('sku=')
  );

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock('@/config/payment');
});

describe('/pricing buy buttons follow the payment providers', () => {
  it('offers Buy when a provider is configured', async () => {
    await renderPricing({ stripeEnabled: true, paypalEnabled: false });

    // The floor mirrors pricing-links.spec.ts's MIN_CHECKOUT_LINKS. Without it
    // this test passes when the grid fails to render at all, and then the
    // assertion below — "zero links when unconfigured" — would be measuring
    // nothing in both directions (#396).
    expect(
      buyLinks().length,
      'the pricing grid did not render its checkout links, so the gated ' +
        'assertion below proves nothing'
    ).toBeGreaterThanOrEqual(5);
  });

  it('offers no Buy at all when neither provider is configured', async () => {
    await renderPricing({ stripeEnabled: false, paypalEnabled: false });

    expect(
      buyLinks().map((a) => a.getAttribute('href')),
      'every one of these leads to /checkout, which cannot charge — the dead ' +
        'end #102 is about, two clicks from every page via the nav'
    ).toEqual([]);

    // Not merely "no links": the packages must still be ADVERTISED, and they
    // must offer nothing clickable. A page that rendered nothing would satisfy
    // the assertion above.
    const soon = screen.getAllByTestId('coming-soon');
    expect(soon.length).toBeGreaterThanOrEqual(5);
    for (const el of soon) {
      expect(el.closest('a')).toBeNull();
      expect(el.querySelector('a,button')).toBeNull();
    }
  });

  it('leaves non-purchase links alone', async () => {
    await renderPricing({ stripeEnabled: false, paypalEnabled: false });

    // THE CONTROL. Gating buy actions must not blank the page's other links —
    // an external href takes no money and has nothing to do with Stripe. If
    // this ever fails, the gate stopped being scoped to purchases and the
    // "zero buy links" assertion above became vacuous.
    expect(
      document.querySelector('a[href^="https://github.com/"]'),
      'the external link disappeared too, so the gate is not scoped to buy actions'
    ).not.toBeNull();
  });
});
