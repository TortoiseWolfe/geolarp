/**
 * A required check must actually run the tests it is required for (#152).
 *
 * Three admin specs skipped themselves on `!!process.env.CI` with the reason
 * "requires local Docker Supabase". That reason was true when written and stopped being true
 * at #575, which made the local lane exactly that — "a Supabase per runner, brought up in the
 * job" — and that lane sets `CI: 'true'`.
 *
 * So the guard fired against the one environment that satisfies it. The hosted lane sets `CI`
 * too, so 29 admin tests (22 + 2 + 5) ran in NEITHER, while `E2E (local) result` stayed a
 * required context on `main`.
 *
 * WHY THIS MATTERS MORE THAN UNUSED COVERAGE. `/admin` is six routes behind `AdminGate`, and
 * `color-contrast.spec.ts` records what happens when nobody checks them properly: before #454
 * it "listed them and measured THE HOME PAGE", because `AdminGate.tsx:81` redirects a
 * non-admin to `/` and a populated, AAA-clean home page passed six times under other routes'
 * names. Same surface; the gate that covers it had never executed one of its own tests.
 *
 * THE FOURTH LINK IS CHECKED ELSEWHERE, ON PURPOSE. A step-level `env:` in the workflow does
 * not reach the test process: Playwright runs inside a container and
 * `scripts/ci/playwright-in-container.sh` forwards an explicit allowlist. The first version of
 * this fix set the flag in the workflow and never added it there, so the guard would have gone
 * on skipping — with all three assertions below green.
 *
 * `playwright-env-forwarding.test.js` caught it, and it is the right place for it: that test
 * DERIVES the required list from `process.env.X` in the E2E sources rather than enumerating it,
 * so it covers every future variable too. Re-asserting the same fact here by name would be a
 * second list to drift against the first — which is the defect that test exists to prevent.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const ADMIN_SPECS = [
  'tests/e2e/admin/admin-dashboard.spec.ts',
  'tests/e2e/admin/admin-conversation-list.spec.ts',
  'tests/e2e/admin/admin-user-pagination.spec.ts',
];
const LANE = '.github/workflows/e2e-local.yml';
const FLAG = 'E2E_LOCAL_SUPABASE';

describe('the admin specs run on the lane that can run them (#152)', () => {
  it('found the specs — a renamed file would make every assertion vacuous', () => {
    for (const spec of ADMIN_SPECS) {
      const body = read(spec);
      assert.ok(body.length > 500, `${spec} did not read`);
      assert.match(body, /test\.skip\(/, `${spec} no longer has a skip guard`);
    }
  });

  for (const spec of ADMIN_SPECS) {
    it(`${path.basename(spec)} does not skip on bare CI`, () => {
      const body = read(spec);
      assert.doesNotMatch(
        body,
        /test\.skip\(\s*!!process\.env\.CI\s*,/,
        `${spec} skips on \`!!process.env.CI\`. Both lanes set CI, so these tests run ` +
          `nowhere — while E2E (local) result remains a required check (#152).`
      );
      assert.match(
        body,
        new RegExp(`process\\.env\\.${FLAG}`),
        `${spec} does not consult ${FLAG}, so it cannot tell the local lane (which ` +
          `provides a Docker Supabase) from the hosted one (which does not)`
      );
    });
  }

  /**
   * The other half. A flag the workflow never sets is a guard that skips everywhere —
   * the same defect with the polarity flipped, and it would look correct in the spec.
   */
  it('the local lane actually sets the flag', () => {
    const wf = read(LANE);
    assert.ok(wf.length > 2000, `${LANE} did not read`);
    assert.match(
      wf,
      new RegExp(`^\\s*${FLAG}: 'true'$`, 'm'),
      `${LANE} does not set ${FLAG}, so the admin specs skip on every lane — the same ` +
        `bug with the polarity flipped`
    );
  });

  /**
   * `homepage.spec.ts:164` keeps a bare-CI skip for a genuine CI limitation (popups).
   * Pinned so this test is not read as "no spec may ever skip on CI", which would be
   * false and would get it deleted.
   */
  it('does not forbid legitimate CI skips elsewhere', () => {
    const body = read('tests/e2e/tests/homepage.spec.ts');
    assert.match(
      body,
      /test\.skip\(!!process\.env\.CI/,
      'homepage.spec.ts lost its CI skip; if that was deliberate, drop this assertion'
    );
  });

  it('the matcher can fail', () => {
    assert.throws(() =>
      assert.doesNotMatch(
        "test.skip(!!process.env.CI, 'x');",
        /test\.skip\(\s*!!process\.env\.CI\s*,/
      )
    );
  });
});
