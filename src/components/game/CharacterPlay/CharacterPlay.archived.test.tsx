/**
 * What players get while the zone and grid modes are archived (playModes.ts).
 *
 * The owner, 2026-10-10: "if you don't want to share your location don't play",
 * and for the two modes that played without it, "archive them for later if we
 * revisit it, don't delete them yet". CharacterPlay.test.tsx keeps testing those
 * modes with the switch on; this file tests the default.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CharacterPlay from './CharacterPlay';
import { LOCATION_FREE_MODES } from './playModes';

const today = new Date('2026-08-26T12:00:00Z');

const mockGeo = vi.hoisted(() => ({
  fix: null as null,
  accuracy: null as number | null,
  error: null as GeolocationPositionError | null,
  getCurrentPosition: vi.fn(),
}));

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    ...mockGeo,
    permission: 'prompt',
    isSupported: true,
    clearWatch: vi.fn(),
    loading: false,
  }),
}));

async function begin() {
  const user = userEvent.setup();
  render(<CharacterPlay today={today} />);
  await screen.findByRole('heading', { name: 'Make a character' });
  await user.type(screen.getByLabelText('Name'), 'Ada Wren');
  await user.click(screen.getByRole('button', { name: 'Roll a character' }));
  await screen.findByRole('heading', { name: 'Ada Wren', level: 2 });
  return user;
}

describe('CharacterPlay with the location-free modes archived', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGeo.error = null;
    mockGeo.getCurrentPosition = vi.fn();
  });

  it('is the default: the switch is off', () => {
    expect(LOCATION_FREE_MODES).toBe(false);
  });

  it('offers only the device location, not a zone or the grid', async () => {
    await begin();
    expect(
      screen.getByRole('button', { name: 'Use my location' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick a zone' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Grid movement' })).toBeNull();
  });

  it('starts on location, and asks nothing until the player presses the button', async () => {
    await begin();
    expect(
      screen.getByRole('status', { name: 'Location status' })
    ).toHaveTextContent('Press “Get my location” to start.');
    expect(mockGeo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('says location is needed when it cannot be had, not that the game plays without it', async () => {
    mockGeo.error = {
      code: 1,
      message: 'User denied Geolocation',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;
    await begin();
    const status = screen.getByRole('status', { name: 'Location status' });
    expect(status).toHaveTextContent('geoLARP needs your location to play.');
    expect(status.textContent).not.toMatch(
      /Pick a zone|grid movement|plays either way/i
    );
  });

  it('no longer tells the player they never have to travel', async () => {
    await begin();
    expect(screen.getByTestId('play-safety').textContent).not.toMatch(
      /grid movement/i
    );
  });
});
