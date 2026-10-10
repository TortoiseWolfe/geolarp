/**
 * /app-privacy/ is the policy the App Store listing links. The owner's rule,
 * 2026-10-10: "kids can't play, everyone shares their full location all the
 * time", and "if you don't want to share your location don't play". This pins
 * that, and fails if the page drifts back to rounding, opt-outs, solo play or a
 * release history.
 *
 * Modelled on AsBuilt-Expo's tests/lane/privacy-page.test.ts, written after that
 * app's first draft said "no tracking" while sending GPS with every photo.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AppPrivacyPage, { metadata } from '@/app/app-privacy/page';

const text = () => {
  const { container } = render(<AppPrivacyPage />);
  return (container.textContent ?? '').replace(/\s+/g, ' ');
};

describe('/app-privacy/', () => {
  it('lives at the URL the App Store listing names', () => {
    expect(metadata.alternates?.canonical).toBe('/app-privacy/');
  });

  it.each([
    ['adults only', 'geoLARP is for adults, 18 and over.'],
    ['no children', 'Children cannot play.'],
    [
      'everyone shares, all the time',
      'Everyone who plays shares their exact location with the other players and game masters, all the time.',
    ],
    [
      'as precise as the phone can give',
      'the most precise position your phone can give',
    ],
    [
      "share or don't play",
      "If you don't want to share your location, don't play.",
    ],
    ['no history', 'No history of where you went is kept.'],
    ['Apple label stated', 'Precise Location'],
    ['account', 'Playing needs a geoLARP account'],
    ['never sold', 'We do not sell it or use it for advertising'],
  ])('promises: %s', (_what, sentence) => {
    expect(text()).toContain(sentence);
  });

  it('never talks about a rough location, an opt-out, solo play or under-18s', () => {
    expect(text()).not.toMatch(
      /100|metre|meter|square|rounded|approximate|close enough|turn it off|block|solo|under 18|13 and over/i
    );
  });

  it('describes the game, not its release history', () => {
    expect(text()).not.toMatch(
      /last updated|this version|later version|coming in/i
    );
  });

  it('never says "no tracking"', () => {
    expect(text()).not.toMatch(/no tracking/i);
  });

  it('names no mailbox; questions go through the contact page', () => {
    expect(text()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});
