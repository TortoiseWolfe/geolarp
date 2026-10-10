/**
 * /app-privacy/ is the policy the App Store listing links, and every sentence in
 * it is a promise about code (geoLARP-Expo) or a decision recorded in
 * docs/privacy/location-intent.md. This pins the promises, so a later edit that
 * softens one has to change this file too, in the same diff.
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
    // This version of the app.
    ['location only on request', 'asks for your location only when you press'],
    [
      'rounded on the phone',
      'on your phone, straight away, rounds it to the 100-metre square',
    ],
    [
      'exact position stays put',
      'Your exact position is never stored, shown or sent.',
    ],
    ['foreground only', 'never uses your location in the background'],
    ['nothing sent today', 'This version makes no network requests.'],
    // Game-master games, as intended.
    ['marked as not built', 'Game-master games (coming in a later version)'],
    ['adults only', 'They are for adults, 18 and over.'],
    [
      'minors stay solo',
      'If you are under 18, you play solo, and your position never leaves your phone.',
    ],
    [
      'the cell, never finer',
      'your current 100-metre square, never your exact position',
    ],
    ['the game master only', 'Other players do not see it.'],
    ['live only', 'It is kept only while the game runs.'],
    ['no history', 'No history of where you went is kept.'],
    ['opt in', 'Nothing is shared until you join a game yourself'],
    ['Apple label stated', 'Precise Location'],
    ['never sold', 'We do not sell it, use it for advertising'],
  ])('promises: %s', (_what, sentence) => {
    expect(text()).toContain(sentence);
  });

  it('never says "no tracking": the game reads location, so say what for instead', () => {
    expect(text()).not.toMatch(/no tracking/i);
  });

  it('names no mailbox; questions go through the contact page', () => {
    expect(text()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});
