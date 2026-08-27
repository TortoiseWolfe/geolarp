/**
 * The hosted E2E lane must SKIP when it cannot run, not fail (#48).
 *
 * WHY. That lane needs three credentials this repo has never had, so
 * `tests/e2e/global-setup.ts` threw "E2E prerequisites not met: 3 missing
 * environment variables" before a single test ran, and `Smoke Tests` and
 * `basePath Project-Site Smoke` went red on every push and every PR. Neither is
 * a required check, so nothing was blocked — which is quietly worse. Two
 * permanently-red checks that mean nothing teach everyone to read red as
 * normal. #663 made this exact argument about `Test Report`; the gate this
 * pins is the same fix one job up.
 *
 * WHY IT CHECKS THE GATE'S *SOURCE* AND NOT JUST ITS EXISTENCE. The obvious
 * way to ask "is this lane configured" is to read the production service-role
 * secret and test it for emptiness. The first version did exactly that, and
 * `service-role-key-not-in-pr-ci.test.js` failed the build for adding an eighth
 * injection site of a key that bypasses RLS on production, into a PR-triggered
 * workflow (#575, #577).
 *
 * It was right to. So the gate reads a VARIABLE instead — which is also the
 * only thing that works, since the `secrets` context is not available in a
 * job-level `if:` at all. Both halves are asserted here, because the next
 * person to touch this will reach for the secret first, exactly as I did.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const E2E = path.join(REPO_ROOT, '.github', 'workflows', 'e2e.yml');
const SIGNAL = 'vars.TEST_USER_PRIMARY_EMAIL';

/** The `build:` job block, up to the next top-level job. */
function buildJob(text) {
  const start = text.search(/^ {2}build:\s*$/m);
  assert.notStrictEqual(start, -1, 'e2e.yml no longer has a `build:` job');
  const rest = text.slice(start + 1);
  const end = rest.search(/^ {2}[a-z][a-z0-9-]*:\s*$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('the hosted E2E lane skips cleanly when unconfigured (#48)', () => {
  const text = fs.readFileSync(E2E, 'utf8');

  it('gates the whole lane at `build`, which everything downstream needs', () => {
    const job = buildJob(text);
    const gate = /^\s*if:\s*(.+)$/m.exec(job);
    assert.ok(
      gate,
      '`build` has no `if:` — without it the lane runs unconfigured and every ' +
        'smoke job fails on missing prerequisites before any test runs (#48)'
    );
    assert.match(
      gate[1],
      new RegExp(SIGNAL.replace('.', '\\.')),
      `\`build\` is gated on something other than ${SIGNAL}`
    );
  });

  it('reads a VARIABLE, never the production service-role secret', () => {
    // Two independent reasons, either one sufficient: it would add an eighth
    // injection site of an RLS-bypassing key into PR-triggered CI (#575), and
    // the `secrets` context is not available in a job-level `if:` regardless.
    const job = buildJob(text);
    const gate = /^\s*if:\s*(.+)$/m.exec(job);
    assert.doesNotMatch(
      gate[1],
      /secrets\./,
      'the `build` gate references the `secrets` context'
    );
  });

  it('says WHY it skipped, so a red-looking run is legible', () => {
    // A silent skip is its own trap: someone eventually asks why the lane never
    // runs, and the answer should be in the run, not in an issue.
    assert.match(
      text,
      /::notice::Hosted E2E lane SKIPPED/,
      'nothing explains the skip in the run log'
    );
    assert.match(text, /#48/, 'the skip notice does not name its ticket');
  });
});
