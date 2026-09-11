/**
 * The local stack's GoTrue must not fall behind production (#136).
 *
 * It had, by nineteen minor versions. `docker-compose.yml` pinned `supabase/gotrue:v2.177.0`
 * while production ran v2.196.0, and the difference was not cosmetic: `current_password`
 * does not exist AT ALL in v2.177.0 — zero occurrences in `internal/api/user.go`, against
 * seven in v2.196.0.
 *
 * WHAT THAT COST. `security_update_password_require_current_password` is live `true`, so
 * password change was broken in production for everyone who signed in with a password. An
 * E2E spec written against the local lane would have sent `current_password`, had it
 * dropped as an unknown JSON key by a server that had never heard of it, passed green, and
 * proven nothing — while the real defect stayed live. That is exactly the shape CLAUDE.md
 * catalogues: "a probe that cannot report failure proves nothing."
 *
 * WHY A FLOOR RATHER THAN AN EQUALITY. Asserting the pin equals a constant written in this
 * same file would be circular — it would pass no matter what the number said. The floor is
 * the thing with meaning behind it: below `MINIMUM`, the local lane cannot reproduce what
 * production enforces, so any auth test that touches password change is measuring a server
 * with different rules. Raising the pin is always allowed; dropping below the version that
 * understands the field is not.
 *
 * The env var names for the two flags are verified against the v2.196.0 binary, not
 * inferred — setting `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD` to a
 * non-boolean makes gotrue fail config load naming both the variable and the Go field it
 * maps to, while a deliberately wrong name is ignored and boot proceeds.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const COMPOSE = 'docker-compose.yml';

/**
 * The first GoTrue that understands `current_password`, and the version production runs.
 * Bump this when production moves; never lower it without saying what replaced the
 * coverage it was standing in for.
 */
const MINIMUM = [2, 196, 0];

/** Strip `#` comments so prose ABOUT an old version is not read as a pin. */
function imagePins(src) {
  return src
    .split('\n')
    .map((line) => line.replace(/#.*$/, ''))
    .filter((line) => /^\s*image:\s*\S*gotrue/.test(line))
    .map((line) => line.trim());
}

function parseVersion(pin) {
  const m = pin.match(/gotrue:v(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

describe('the local GoTrue keeps up with production (#136)', () => {
  const src = fs.readFileSync(path.join(ROOT, COMPOSE), 'utf8');

  it('finds exactly one gotrue image pin — a second one would drift unnoticed', () => {
    const pins = imagePins(src);
    assert.strictEqual(
      pins.length,
      1,
      `expected one gotrue image pin in ${COMPOSE}, found ${pins.length}: ${pins.join(' | ')}. ` +
        `Two pins means one of them can fall behind silently, which is the defect this file exists for.`
    );
  });

  it('is at or above the version that understands current_password', () => {
    const [pin] = imagePins(src);
    const version = parseVersion(pin);
    assert.ok(version, `could not parse a version out of: ${pin}`);
    assert.ok(
      cmp(version, MINIMUM) >= 0,
      `${COMPOSE} pins gotrue v${version.join('.')}, below v${MINIMUM.join('.')}. ` +
        `Below that, \`current_password\` does not exist in the server at all — an auth E2E ` +
        `spec would send it, have it dropped as an unknown key, and pass green having ` +
        `measured nothing (#136).`
    );
  });

  it('the comment-stripper works — or both assertions above are vacuous', () => {
    // The pin's own comment block names v2.177.0 as the version being left behind. Without
    // stripping, that prose reads as a pin and the floor check fails against correct code —
    // which is precisely what happened while writing this.
    const withProse = [
      '    # This was pinned at supabase/gotrue:v2.177.0, which is too old',
      '    image: supabase/gotrue:v2.196.0',
    ].join('\n');
    assert.deepStrictEqual(imagePins(withProse), [
      'image: supabase/gotrue:v2.196.0',
    ]);
  });
});
