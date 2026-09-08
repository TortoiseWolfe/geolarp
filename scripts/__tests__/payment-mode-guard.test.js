/**
 * The deployed-Stripe-key-mode guard, RUN rather than read (#102).
 *
 * This extracts the actual `run:` block out of `smoke.yml` and executes it against a
 * stubbed `curl`. It is deliberately not a reimplementation of the guard's rules: a
 * checker only ever observed passing has not been shown to work, and the shipped
 * shell is the thing that runs in production.
 *
 * WHAT #102 WAS. `/checkout/?sku=svc-site` shipped no publishable key at all, and this
 * step hard-failed — correctly by its own logic, about something nobody intended yet.
 * geoLARP is pre-launch with no store, so the ABSENCE is the intent. A monitor that
 * reds on the intended state is one people stop reading, which is exactly how this
 * check came to be invisible in the first place: it sat below a failing step and
 * reported `skipped` on every run (#83, #100).
 *
 * `none` therefore INVERTS the assertion rather than disabling it, and both directions
 * are asserted below. A key appearing while the declared intent is "no payments" is a
 * real regression — someone set the variable, or a fork's key leaked into a build —
 * and deleting the check would have covered neither direction.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SMOKE = path.join(ROOT, '.github', 'workflows', 'smoke.yml');
const STEP = 'Deployed bundle ships the expected Stripe key mode';

/**
 * Pull the step's `run: |` body out of the workflow and dedent it.
 *
 * Hand-parsed rather than via a YAML library, because the point is to run the exact
 * text that ships. The assertion below is what stops this silently extracting nothing
 * — an empty script would "pass" every case in the happiest possible way.
 */
function extractRunScript() {
  const lines = fs.readFileSync(SMOKE, 'utf8').split('\n');
  const at = lines.findIndex((l) => l.includes(`- name: ${STEP}`));
  assert.ok(at !== -1, `step "${STEP}" not found in smoke.yml`);
  const runAt = lines.findIndex((l, i) => i > at && /^\s*run: \|/.test(l));
  assert.ok(runAt !== -1, 'no `run: |` block after the step name');
  const indent = lines[runAt].match(/^\s*/)[0].length + 2;
  const body = [];
  for (let i = runAt + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '') {
      body.push('');
      continue;
    }
    if (l.match(/^\s*/)[0].length < indent) break;
    body.push(l.slice(indent));
  }
  const script = body.join('\n');
  assert.ok(
    script.includes('PAYMENT_MODE_EXPECTED') && script.includes('pk_'),
    'extracted script does not look like the key-mode guard; the parser drifted'
  );
  return script;
}

const SCRIPT = extractRunScript();

/** Run the shipped script with `curl` stubbed to serve `bundle` from one chunk. */
function runGuard({ expected, bundle }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paymode-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  // The guard calls curl twice: once for the checkout HTML, then once per chunk.
  // The shim answers on the URL, which is always the last argument.
  fs.writeFileSync(
    path.join(bin, 'curl'),
    `#!/bin/sh
# POSIX last-argument: \${@: -1} is a bashism and /bin/sh here is dash.
for a in "$@"; do url="$a"; done
case "$url" in
  *"/checkout/"*) printf '%s' '<script src="/_next/static/chunks/app-abc.js"></script>' ;;
  *"/_next/static/chunks/"*) cat "${path.join(dir, 'chunk.js')}" ;;
  *) exit 22 ;;
esac
`,
    { mode: 0o755 }
  );
  fs.writeFileSync(path.join(dir, 'chunk.js'), bundle);
  fs.writeFileSync(path.join(dir, 'guard.sh'), SCRIPT);

  const r = spawnSync('bash', [path.join(dir, 'guard.sh')], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      SITE: 'https://example.invalid',
      EXPECTED: expected,
    },
    encoding: 'utf8',
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const NO_KEY = 'console.log("no keys here");';
const TEST_KEY = 'const k="pk_test_51abcdef";';
const LIVE_KEY = 'const k="pk_live_51abcdef";';

describe('PAYMENT_MODE_EXPECTED guard', () => {
  it('none + no key in the bundle passes — the absence IS the declared intent', () => {
    const { code, out } = runGuard({ expected: 'none', bundle: NO_KEY });
    assert.strictEqual(code, 0, out);
    assert.match(out, /none intended/);
  });

  /**
   * THE HALF THAT MAKES `none` A CHECK RATHER THAN AN OFF SWITCH. Without this,
   * "payments are deferred" would mean "stop looking", and a key shipping by
   * accident would be the one thing nobody noticed.
   */
  it('none + a key present FAILS — nobody declared that key', () => {
    const { code, out } = runGuard({ expected: 'none', bundle: TEST_KEY });
    assert.strictEqual(code, 1, out);
    assert.match(out, /nobody declared/);
  });

  it('test + no key still fails, and now says how to declare the absence', () => {
    const { code, out } = runGuard({ expected: 'test', bundle: NO_KEY });
    assert.strictEqual(code, 1, out);
    assert.match(out, /cannot charge at all/);
    assert.match(out, /PAYMENT_MODE_EXPECTED=none/);
  });

  it('test + a test key passes', () => {
    const { code, out } = runGuard({ expected: 'test', bundle: TEST_KEY });
    assert.strictEqual(code, 0, out);
    assert.match(out, /production is in test mode/);
  });

  /** The pre-existing behaviour this change must not have weakened. */
  it('live + a test key fails — the wrong mode shipped', () => {
    const { code, out } = runGuard({ expected: 'live', bundle: TEST_KEY });
    assert.strictEqual(code, 1, out);
    assert.match(out, /wrong key shipped|PAYMENT_MODE_EXPECTED is 'live'/);
  });

  it('live + a live key passes', () => {
    const { code, out } = runGuard({ expected: 'live', bundle: LIVE_KEY });
    assert.strictEqual(code, 0, out);
    assert.match(out, /production is in live mode/);
  });
});
