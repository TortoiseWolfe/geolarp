import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaySheet from '@/components/game/PlaySheet';

/**
 * THE MVP PRIVACY RULE, AS A TEST: nothing a player enters leaves the device.
 *
 * Two halves, because each alone can pass for the wrong reason. The static half
 * reads the source of the surface and fails on any way to reach a network or
 * ask for a location. The runtime half replaces every outbound path with a spy,
 * plays a whole session (create, roll, export, remove) and asserts none was
 * touched. If the surface ever syncs, signs in or asks for a location, one of
 * these fails, and the change goes to Jonathan before it ships.
 */
const FILES = [
  'src/components/game/PlaySheet/PlaySheet.tsx',
  'src/components/game/PlaySheet/usePlaySheet.ts',
  'src/components/game/CharacterBuilder/CharacterBuilder.tsx',
  'src/lib/geolarp/library.ts',
  'src/lib/geolarp/creation.ts',
  'src/app/play/page.tsx',
  'src/app/play/PlayClient.tsx',
];

const FORBIDDEN: Array<[string, RegExp]> = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['sendBeacon', /sendBeacon/],
  ['WebSocket', /WebSocket|EventSource/],
  ['geolocation', /geolocation|useGeolocation|LocationButton/i],
  ['supabase', /supabase|createClient/i],
  ['auth', /useAuth|AuthContext|\bsignIn|\bsignUp|\bsignOut/],
  ['cookies', /document\.cookie/],
  ['analytics', /gtag|analytics/i],
];

const code = (file: string) =>
  readFileSync(join(process.cwd(), file), 'utf8')
    // Comments may name what is forbidden; only code counts.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('the play surface is local-only (source)', () => {
  it.each(FILES)('%s reaches no network, account or location API', (file) => {
    const src = code(file);
    for (const [name, re] of FORBIDDEN) {
      expect(re.test(src), `${file} mentions ${name}`).toBe(false);
    }
  });

  it('would catch a violation (the check can fail)', () => {
    expect(FORBIDDEN.some(([, re]) => re.test('await fetch("/x")'))).toBe(true);
    expect(
      FORBIDDEN.some(([, re]) =>
        re.test('navigator.geolocation.getCurrentPosition')
      )
    ).toBe(true);
  });
});

describe('the play surface is local-only (a whole session)', () => {
  const calls: string[] = [];
  const spy = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls.push(`${name} ${JSON.stringify(args).slice(0, 80)}`);
      throw new Error(`${name} must not be called`);
    });

  beforeEach(() => {
    calls.length = 0;
    window.localStorage.clear();
    vi.stubGlobal('fetch', spy('fetch'));
    vi.stubGlobal('XMLHttpRequest', spy('XMLHttpRequest'));
    vi.stubGlobal('WebSocket', spy('WebSocket'));
    vi.stubGlobal('EventSource', spy('EventSource'));
    Object.defineProperty(navigator, 'sendBeacon', {
      value: spy('sendBeacon'),
      configurable: true,
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: spy('getCurrentPosition'),
        watchPosition: spy('watchPosition'),
        clearWatch: spy('clearWatch'),
      },
      configurable: true,
    });
    URL.createObjectURL = vi.fn(() => 'blob:local');
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('creates, rolls, exports and removes without one outbound call', async () => {
    render(
      React.createElement(PlaySheet, {
        today: new Date('2026-11-04T12:00:00Z'),
      })
    );
    await userEvent.type(await screen.findByLabelText('Name'), 'Ada Wren');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create character' })
    );
    await userEvent.selectOptions(
      await screen.findByLabelText('Difficulty'),
      'heroic'
    );
    await userEvent.click(screen.getByRole('button', { name: /^Search/ }));
    await userEvent.click(screen.getByRole('button', { name: /Roll/ }));
    await userEvent.click(
      screen.getByRole('button', { name: /Export Ada Wren/ })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove from this device' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove it' }));

    expect(calls).toEqual([]);
    // And the data went where the promise says: this browser's storage.
    expect(window.localStorage.getItem('geolarp_characters')).not.toBeNull();
  });
});
