/**
 * The 100-metre rounding, and the boundary that keeps it true (#39).
 *
 * WHAT THIS IS DEFENDING. `public/blog/the-world-is-the-board.md:87` is live and
 * says location is "rounded to 100 metres before anything is done with it". The
 * product also says it to the player directly, at CharacterPlay.tsx:310: "Location
 * rounded to a 100-metre cell. The precise fix was discarded." Both were false: the
 * hook stored the raw `GeolocationPosition` and handed it to every consumer.
 *
 * WHY A SOURCE SCAN AND NOT ONLY BEHAVIOUR TESTS. The defect was never in one
 * function — it was in there being FOUR places that reached for the platform, one
 * of which (`map.locate`) nobody had counted because it does not contain the string
 * `navigator.geolocation`. Behavioural tests would have passed on three of them. The
 * only durable form of "rounded before anything is done with it" is "there is one
 * door, and this is it".
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cellCentre, cellOf } from '@/lib/geolarp/cell';
import { coarseFixFrom, GRID_POSITION_OPTIONS } from '@/lib/geolarp/coarseFix';

const SRC = join(process.cwd(), 'src');

/** Every source file, excluding tests and stories — they mock the platform on purpose. */
function sourceFiles(dir: string = SRC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.(test|spec|stories)\./.test(entry)) continue;
    out.push(full);
  }
  return out;
}

const FILES = sourceFiles();

/** The one file allowed to touch the platform. */
const SOCKET = 'lib/geolarp/coarseFix.ts';

/**
 * Comments are prose, not calls.
 *
 * Written after the first run of this file failed on its own documentation: the
 * comment in MapContainerInner explaining why `map.locate(` was deleted matched a
 * scan for `map.locate(`, and three files describing the `enableHighAccuracy`
 * decision matched a scan for it. A gate that cannot tell code from an explanation
 * of the code is a gate that will be weakened until it passes.
 *
 * The `[^:]` guard on the line-comment rule keeps `https://` in a string literal
 * from truncating the rest of its line, which would hide a real call sitting
 * after a URL.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function grep(pattern: RegExp): string[] {
  return FILES.filter((f) =>
    pattern.test(stripComments(readFileSync(f, 'utf8')))
  ).map((f) => relative(SRC, f).split('\\').join('/'));
}

describe('the device-location boundary', () => {
  it('scans a real number of files — a silent zero is not a pass', () => {
    // Without this the assertions below are green when the walker breaks, which is
    // the exact shape of failure this file exists to prevent (#396).
    expect(FILES.length).toBeGreaterThan(200);
    expect(grep(/cellCentre/).length).toBeGreaterThan(0);
  });

  /**
   * ANCHORED ON THE FULL CALL, deliberately.
   *
   * A scan for the bare method names cannot work: `getCurrentPosition(` also matches
   * the hook's OWN returned function, which /map, CharacterPlay and the hook's tests
   * all legitimately call. A gate written that way is red on the files it just
   * fixed, which is how a gate gets weakened until it means nothing.
   */
  it('reaches navigator.geolocation from exactly one file', () => {
    expect(
      grep(/navigator\.geolocation\.(getCurrentPosition|watchPosition)\s*\(/),
      'a second file is calling the platform directly. That is how this defect got ' +
        'four entry points: every one of them looked reasonable on its own.'
    ).toEqual([SOCKET]);
  });

  /**
   * `map.locate()` is Leaflet's own geolocation and contains no `navigator.` string,
   * so the assertion above cannot see it. It was the fourth entry point, it fired on
   * mount with no user gesture, and it moved the viewport onto the real fix.
   */
  it('never calls Leaflet map.locate(), which is geolocation by another name', () => {
    expect(
      grep(/\bmap\.locate\s*\(/),
      'Leaflet locate() bypasses the socket entirely and takes the map with it.'
    ).toEqual([]);
  });

  /**
   * Permission to touch the platform is not the same as routing through it. This is
   * the assertion that the socket is actually used, rather than merely being the
   * only file allowed to exist.
   */
  it('every file that handles a fix imports the quantiser', () => {
    const handlers = grep(/coarseFixFrom|getCoarseFix|watchCoarseFix/);
    expect(handlers).toContain(SOCKET);
    expect(handlers.length).toBeGreaterThanOrEqual(2);
    for (const f of handlers) {
      const body = readFileSync(join(SRC, f), 'utf8');
      if (f === SOCKET) continue;
      expect(body, `${f} uses the socket without importing it`).toMatch(
        /from '@\/lib\/geolarp\/coarseFix'/
      );
    }
  });

  it('states the ask exactly once, and it is this', () => {
    // `toEqual`, not `toMatchObject`: removing a key must fail.
    expect(GRID_POSITION_OPTIONS).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    });
    expect(
      grep(/enableHighAccuracy/),
      'the ask is restated somewhere else, so there is no single answer to "what ' +
        'does this app request of a device"'
    ).toEqual([SOCKET]);
  });
});

describe('coarseFixFrom', () => {
  const raw = (lat: number, lon: number, accuracy = 5): GeolocationPosition =>
    ({
      coords: { latitude: lat, longitude: lon, accuracy },
      timestamp: 1_757_000_000_000,
    }) as GeolocationPosition;

  it('returns the cell centre, never the reading', () => {
    const fix = coarseFixFrom(raw(35.045612345, -85.309787654));
    expect(fix.lat).not.toBe(35.045612345);
    expect(fix.lon).not.toBe(-85.309787654);
    expect(fix.lat).toBe(cellCentre(cellOf(35.045612345, -85.309787654)).lat);
    expect(fix.lon).toBe(cellCentre(cellOf(35.045612345, -85.309787654)).lon);
  });

  /**
   * The raw pair must be ABSENT, not merely unused. A field riding along — the
   * original `GeolocationPosition` under some other key — is exactly the shape that
   * makes a rounded value look safe while carrying the thing it replaced.
   */
  it('carries no other field', () => {
    const fix = coarseFixFrom(raw(51.505, -0.09, 10));
    expect(Object.keys(fix).sort()).toEqual([
      'accuracy',
      'cell',
      'lat',
      'lon',
      'timestamp',
    ]);
    expect(JSON.stringify(fix)).not.toContain('coords');
  });

  it('keeps the accuracy radius, which carries no position', () => {
    expect(coarseFixFrom(raw(51.505, -0.09, 37)).accuracy).toBe(37);
  });

  /**
   * THE PROPERTY THAT MAKES THIS SAFE FOR THE GAME. Feeding the cell centre back
   * through `cellOf` must land in the same cell, or quantising at the boundary
   * would change which encounter a player meets. It is a fixed point.
   */
  it('is a fixed point: rounding the centre gives the same cell', () => {
    let checked = 0;
    let worst = 0;
    for (let i = 0; i < 4000; i++) {
      // Deterministic sweep rather than random: a seeded spiral over the globe,
      // avoiding the poles where the longitude quantum degenerates.
      const lat = -75 + (i * 150) / 4000;
      const lon = -180 + ((i * 227) % 360);
      const cell = cellOf(lat, lon);
      const centre = cellCentre(cell);
      const round2 = cellOf(centre.lat, centre.lon);
      expect(round2).toEqual(cell);
      const fix = coarseFixFrom(raw(lat, lon));
      expect(fix.cell).toEqual(cell);
      const dLat = Math.abs(centre.lat - lat) * 111_320;
      const dLon =
        Math.abs(centre.lon - lon) * 111_320 * Math.cos((lat * Math.PI) / 180);
      worst = Math.max(worst, Math.hypot(dLat, dLon));
      checked += 1;
    }
    expect(checked).toBe(4000);
    // Half a diagonal of a 100m cell is ~70.7m; nothing may exceed it.
    expect(worst).toBeLessThan(71);
  });
});
