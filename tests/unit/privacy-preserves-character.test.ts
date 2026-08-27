/**
 * A geoLARP character must survive /privacy-controls (#37).
 *
 * `clearUserData` removes every localStorage key not on its allowlist. The
 * character is the player's own creation, not tracking data, and the published
 * promise is that the game "will warn you rather than quietly lose it"
 * (the-world-is-the-board.md:101-103). This asserts the key is actually passed
 * through — a prop that exists but is never wired reads exactly like one that
 * works.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearUserData } from '@/utils/privacy';
import {
  STORAGE_KEY,
  generateCharacter,
  loadCharacter,
  saveCharacter,
} from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';

vi.mock('@/utils/consent-history', () => ({
  clearConsentHistory: vi.fn(),
}));

describe('clearUserData and the character key', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('destroys the character when the key is NOT preserved', async () => {
    // The negative control. This is the shipped behaviour #37 describes, and
    // it is what makes the positive case below mean something.
    saveCharacter(generateCharacter('Ada Wren', new Rng('x')));
    window.localStorage.setItem('some-tracking-key', '1');

    await clearUserData({ keepLocalStorage: ['cookieConsent'] });

    expect(loadCharacter()).toBeNull();
    expect(window.localStorage.getItem('some-tracking-key')).toBeNull();
  });

  it('keeps the character when the key IS preserved', async () => {
    const character = generateCharacter('Ada Wren', new Rng('x'));
    saveCharacter(character);
    window.localStorage.setItem('some-tracking-key', '1');

    await clearUserData({
      keepLocalStorage: ['cookieConsent', STORAGE_KEY],
    });

    expect(loadCharacter()).toEqual(character);
    // Everything else still goes — this is still a delete.
    expect(window.localStorage.getItem('some-tracking-key')).toBeNull();
  });
});
