/**
 * The only place in this application that touches `navigator.geolocation`.
 *
 * EXACT, NOT ROUNDED (#183). The owner, 2026-10-10: the device needs "precision of
 * where you are, no rounding or vaguing, as accurate as we can get". So a fix carries
 * the device's own latitude and longitude, as precisely as the browser reports them,
 * with the cell it falls in. The 100-metre cell is what encounters are built from; it
 * is not a cap on what the game knows. This file replaced `coarseFix.ts` (#39), which
 * kept only the cell centre and dropped the reading inside the platform callback.
 *
 * WHY A SOCKET, STILL. #39 found four separate entry points to the platform API (the
 * hook, the map's own call, Leaflet's `map.locate`, and the game screen), each asking
 * for something different. Wrapping the API here and asserting it appears in exactly
 * one file (`tests/unit/device-fix.test.ts`) is what keeps one answer to "what does
 * this app ask of a device", and one place to change it.
 *
 * @module lib/geolarp/deviceFix
 */

import { cellOf, type Cell } from './cell';

/** One reading from the device, and the cell it is in. */
export interface DeviceFix {
  /** The cell the reading falls in: what the encounter is built from. */
  cell: Cell;
  /** The device's latitude, exactly as reported. */
  lat: number;
  /** The device's longitude, exactly as reported. */
  lon: number;
  /** The device's own error radius in metres. */
  accuracy: number;
  timestamp: number;
}

/**
 * The entire ask this product makes of any device, stated once.
 *
 * `enableHighAccuracy: true` asks for the best fix the device can give. No cache
 * (`maximumAge: 0`): a walking game must not answer a second press with the
 * reading from before the player walked.
 */
export const GRID_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  // A cold high-accuracy fix routinely takes longer than five seconds.
  timeout: 10_000,
  maximumAge: 0,
};

/** A platform reading as a DeviceFix: the exact position, and its cell. */
export function deviceFixFrom(position: GeolocationPosition): DeviceFix {
  const { latitude, longitude, accuracy } = position.coords;
  return {
    cell: cellOf(latitude, longitude),
    lat: latitude,
    lon: longitude,
    accuracy,
    timestamp: position.timestamp,
  };
}

export type DeviceFixHandler = (fix: DeviceFix) => void;
export type DeviceFixErrorHandler = (error: GeolocationPositionError) => void;

/** Whether this environment can produce a fix at all. */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** One reading. */
export function getDeviceFix(
  onFix: DeviceFixHandler,
  onError: DeviceFixErrorHandler
): void {
  if (!isGeolocationSupported()) return;
  navigator.geolocation.getCurrentPosition(
    (position) => onFix(deviceFixFrom(position)),
    onError,
    GRID_POSITION_OPTIONS
  );
}

/** The same, continuously. Returns a watch id, or null if unsupported. */
export function watchDeviceFix(
  onFix: DeviceFixHandler,
  onError: DeviceFixErrorHandler
): number | null {
  if (!isGeolocationSupported()) return null;
  return navigator.geolocation.watchPosition(
    (position) => onFix(deviceFixFrom(position)),
    onError,
    GRID_POSITION_OPTIONS
  );
}

/** Stop a watch started by `watchDeviceFix`. */
export function clearDeviceWatch(id: number): void {
  if (!isGeolocationSupported()) return;
  navigator.geolocation.clearWatch(id);
}
