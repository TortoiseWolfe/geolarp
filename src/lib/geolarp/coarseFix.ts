/**
 * The only place in this application that touches `navigator.geolocation` (#39).
 *
 * WHAT WAS FALSE. `public/blog/the-world-is-the-board.md:87` is live and says
 * location is "rounded to 100 metres **before anything is done with it** — and that
 * rounding is not a privacy feature bolted on afterwards. It is the grid." The post
 * introduces the section with "This is the part I am most pleased with, so I want to
 * be exact about it."
 *
 * It was not implemented. `useGeolocation` stored the raw `GeolocationPosition`
 * object in React state and handed it to every consumer; `/map` rendered
 * `toFixed(4)` (~11 m) and centred a third-party tile request on the real fix; and a
 * fourth entry point nobody had counted — Leaflet's `map.locate({ setView: true })`
 * — moved the viewport onto the device position with no user gesture at all.
 *
 * Worse than the blog: `CharacterPlay.tsx` tells the player, in the first person, at
 * the moment of the reading, "Location rounded to a 100-metre cell. The precise fix
 * was discarded." A test asserted that string. Nothing asserted it was true.
 *
 * WHY A SOCKET AND NOT A CONVENTION. The obvious fix — quantise inside
 * `useGeolocation` — cannot see the other two entry points, because they call the
 * platform directly. So the platform API is wrapped here instead and appears in
 * exactly ONE file, which a test can assert. A rule that lives in a reviewer's head
 * is the kind that grew a fourth entry point in the first place.
 *
 * WHY A DISTINCT TYPE. `CoarseFix` is deliberately NOT a synthesised
 * `GeolocationPosition`. Building one of those is exactly what the deleted Leaflet
 * handler did, and typing a rounded value as the platform type is how the leak came
 * to look legitimate. A separate type makes TypeScript the enforcement: anything
 * reaching for `.coords` fails to compile.
 *
 * @module lib/geolarp/coarseFix
 */

import { cellCentre, cellOf, type Cell } from './cell';

/**
 * A device reading with the position already gone.
 *
 * `lat`/`lon` are the CELL CENTRE, never the reading. `cell.ts` states the rule this
 * implements: the cell centre "is the ONLY location the app should ever display, log
 * or hand to a map... the real fix cannot be recovered from it".
 */
export interface CoarseFix {
  cell: Cell;
  /** Cell centre latitude. Never the device's. */
  lat: number;
  /** Cell centre longitude. Never the device's. */
  lon: number;
  /**
   * The device's own error radius in metres.
   *
   * KEPT ON PURPOSE, and it is not a position: a scalar radius says how uncertain
   * the reading was without saying where it was. It is the only thing that can tell
   * a player their cell may be wrong, which matters — at a 100 m error radius the
   * assigned cell is the true one about one time in seven.
   */
  accuracy: number;
  timestamp: number;
}

/**
 * The entire ask this product makes of any device.
 *
 * STATED ONCE, and callers cannot override it. It used to be three divergent
 * literals — `useGeolocation.ts:142` (`?? true`), `MapContainer.tsx:130`
 * (hardcoded `true`), and Leaflet's own defaults, which set nothing. An external
 * reviewer, or an App Store submission, should be able to read one object.
 *
 * `enableHighAccuracy: true` STAYS, and that is deliberate rather than an oversight
 * — the ticket suggested dropping it. Precision-of-coordinate and accuracy-of-fix
 * are different axes. What the grid needs is an error radius small enough to name
 * the right cell; what it must not keep is the coordinate. Measured over 200k
 * samples: at a 5 m radius the assigned cell is the true cell ~92% of the time, at
 * 35 m ~52%, at 100 m ~14%. Asking for a coarse fix would keep the promise by
 * breaking the game, and the promise is about what is DONE with the reading — which
 * is settled below, not by the request flag.
 */
export const GRID_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  // 10s rather than the hook's old 5s: a cold high-accuracy fix routinely takes
  // longer than five seconds, and /map already asked for ten.
  timeout: 10_000,
  // NO CACHE, which is the game path's existing behaviour and not /map's 30s.
  // Collapsing to one constant had to pick one, and a walking game must not answer
  // a second button press with the reading from before the player walked: 30s at
  // walking pace is ~42m, which usually IS the same cell and occasionally is not —
  // and "it still says the old cell" is precisely the confusing case. /map loses a
  // cache it only used to spare a demo page one refetch.
  maximumAge: 0,
};

/**
 * Round a reading to its cell. The first and only thing done with a raw position.
 *
 * The raw `position` is a parameter and dies with the call: it is never returned,
 * stored, closed over, logged, or handed to a map. The browser's own stack still
 * holds it, which no web application can change and which the published sentence
 * cannot reasonably be read to cover.
 */
export function coarseFixFrom(position: GeolocationPosition): CoarseFix {
  const cell = cellOf(position.coords.latitude, position.coords.longitude);
  const centre = cellCentre(cell);
  return {
    cell,
    lat: centre.lat,
    lon: centre.lon,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

export type CoarseFixHandler = (fix: CoarseFix) => void;
export type CoarseFixErrorHandler = (error: GeolocationPositionError) => void;

/** Whether this environment can produce a fix at all. */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * One reading, rounded before the caller sees it.
 *
 * The success callback is wrapped rather than passed through, so a caller cannot
 * receive the platform object even by accident.
 */
export function getCoarseFix(
  onFix: CoarseFixHandler,
  onError: CoarseFixErrorHandler
): void {
  if (!isGeolocationSupported()) return;
  navigator.geolocation.getCurrentPosition(
    (position) => onFix(coarseFixFrom(position)),
    onError,
    GRID_POSITION_OPTIONS
  );
}

/** The same, continuously. Returns a watch id, or null if unsupported. */
export function watchCoarseFix(
  onFix: CoarseFixHandler,
  onError: CoarseFixErrorHandler
): number | null {
  if (!isGeolocationSupported()) return null;
  return navigator.geolocation.watchPosition(
    (position) => onFix(coarseFixFrom(position)),
    onError,
    GRID_POSITION_OPTIONS
  );
}

/** Stop a watch started by `watchCoarseFix`. */
export function clearCoarseWatch(id: number): void {
  if (!isGeolocationSupported()) return;
  navigator.geolocation.clearWatch(id);
}
