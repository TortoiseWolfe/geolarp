/**
 * `window.leafletMap` is a TEST CONVENIENCE, and it must not ship (#113).
 *
 * `MapContainer` assigns the live Leaflet instance to `window` so
 * `tests/e2e/map.spec.ts` can drive it — it reads the handle in a dozen places.
 * The guard used to be `typeof window !== 'undefined'`, which is an SSR check
 * rather than an environment one, so the handle was also live in production,
 * offering any script on the page the map instance, its centre and its zoom.
 *
 * WHY NOT JUST `NODE_ENV === 'development'`, which is what the ticket proposed:
 * both E2E lanes run `pnpm build` and serve the static export with
 * `npx serve out`, so NODE_ENV is `production` in exactly the runs that need the
 * handle. That one-liner would have gone green here and taken the entire map
 * suite down in CI. The build sets `NEXT_PUBLIC_E2E` instead.
 *
 * That splits the correctness across three files that nothing else connects —
 * the component, and the build step of each lane — plus a fourth that must NOT
 * connect: `deploy.yml`. This file is that connection. Every assertion below is
 * one that fails silently in production if it stops holding: the handle either
 * disappears from CI (loud) or reappears in the deployed bundle (silent, and the
 * bad direction).
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const COMPONENT = 'src/components/map/MapContainer/MapContainer.tsx';
const E2E_LANES = [
  '.github/workflows/e2e-local.yml',
  '.github/workflows/e2e.yml',
];
const DEPLOY = '.github/workflows/deploy.yml';

describe('the window.leafletMap handle has a direction', () => {
  it('reads a real component — a silent empty file is not a pass', () => {
    const src = read(COMPONENT);
    assert.ok(
      src.length > 1000,
      `${COMPONENT} is suspiciously small; the assertions below would be vacuous`
    );
    assert.match(
      src,
      /leafletMap/,
      'the handle is gone entirely. If that is deliberate, delete this file and ' +
        'the dozen reads in tests/e2e/map.spec.ts with it.'
    );
  });

  it('gates the assignment on the environment, not merely on SSR', () => {
    const src = read(COMPONENT);
    assert.match(
      src,
      /process\.env\.NEXT_PUBLIC_E2E === 'true'/,
      'the E2E clause is gone, so the handle is absent from CI and the map suite ' +
        'cannot drive the map'
    );
    assert.match(
      src,
      /process\.env\.NODE_ENV === 'development'/,
      'the development clause is gone, so `pnpm dev` no longer exposes the handle'
    );
    // The original defect, pinned directly: an assignment guarded ONLY by the
    // SSR check. Matching the guard rather than the assignment, because the
    // assignment line itself is unchanged.
    assert.doesNotMatch(
      src,
      /if \(typeof window !== 'undefined'\) \{\s*\(window as Window & \{ leafletMap/,
      'the guard is back to a bare SSR check, which is how this shipped to ' +
        'production in the first place (#113)'
    );
  });

  for (const lane of E2E_LANES) {
    it(`${lane} builds with NEXT_PUBLIC_E2E set`, () => {
      const yml = read(lane);
      assert.match(
        yml,
        /^\s*NEXT_PUBLIC_E2E: 'true'$/m,
        `${lane} no longer sets NEXT_PUBLIC_E2E, so its build has no map handle ` +
          `and every test in map.spec.ts that reads window.leafletMap fails`
      );
    });
  }

  /**
   * THE ONE THAT MATTERS, and the only one whose failure is silent.
   *
   * A missing flag in an E2E lane goes red immediately. A flag that leaks into
   * the deploy build goes green forever and puts the handle back on the live
   * site — the exact state this ticket exists to end.
   */
  it('deploy.yml does NOT set it, so the shipped bundle has no handle', () => {
    const yml = read(DEPLOY);
    assert.ok(yml.length > 1000, 'deploy.yml did not read; assertion vacuous');
    assert.doesNotMatch(
      yml,
      /NEXT_PUBLIC_E2E/,
      'deploy.yml sets NEXT_PUBLIC_E2E, which puts the live Leaflet instance ' +
        'back on window for every visitor'
    );
  });

  /**
   * The control. Without it, a `read()` that silently returned '' would satisfy
   * every `doesNotMatch` above and this file would certify nothing.
   */
  it('the comparator can fail', () => {
    assert.throws(() =>
      assert.doesNotMatch('NEXT_PUBLIC_E2E', /NEXT_PUBLIC_E2E/)
    );
    assert.throws(() => assert.match('', /NEXT_PUBLIC_E2E/));
  });
});
