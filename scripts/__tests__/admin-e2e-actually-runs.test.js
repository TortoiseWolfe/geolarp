/**
 * The admin specs must not claim a reason that is false (#152 → #159).
 *
 * Three admin specs carried `test.skip(!!process.env.CI, 'Skipped in CI: requires local Docker
 * Supabase')`. That reason was true when written and stopped being true at #575, which made the
 * local lane exactly that — "a Supabase per runner, brought up in the job" — while
 * `e2e-local.yml` sets `CI: 'true'`. The guard therefore fired against the one environment that
 * satisfies it, and the hosted lane sets `CI` too, so 29 tests ran in NEITHER while
 * `E2E (local) result` stayed a required context on `main`.
 *
 * WHAT UNSKIPPING THEM FOUND, AND WHY THIS FILE NO LONGER CHECKS A LANE FLAG. The first CI run
 * of those 29 produced 3 failures and 26 skips (`mode: 'serial'` — one failure per file skips
 * the rest). The blocker is not the environment: the specs sign in as `test@example.com` and
 * assume admin-ness comes from `app_metadata`, but `user_profiles.is_admin` is "the single
 * authority since #240" (`admin-depth.spec.ts:15-18`). `AdminGate` redirects, renders `null`,
 * and the console container never appears — in EVERY environment. No lane keying fixes that,
 * so the interim flag this file used to pin is gone rather than left as dead config.
 *
 * WHY THIS STILL MATTERS. `/admin` is six routes behind `AdminGate`, and #454 is the scar:
 * `color-contrast.spec.ts` "listed them and measured THE HOME PAGE" six times, because a
 * non-admin is redirected to a clean, AAA-passing home page. Twenty-nine tests presenting as
 * admin coverage while measuring nothing is that same failure wearing a test count — which is
 * why the reason attached to them has to be true.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/**
 * Comments quote the very code these assertions forbid, so a raw match reads a spec's
 * explanation of the old guard as the old guard. That is not hypothetical — writing this file
 * without it produced three failures against specs that had already been fixed, which is a
 * probe reporting on itself. `fix-boundary.test.ts:64-69` solves the same problem the same way
 * and keeps a case proving the stripper works.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ADMIN_SPECS = [
  'tests/e2e/admin/admin-dashboard.spec.ts',
  'tests/e2e/admin/admin-conversation-list.spec.ts',
  'tests/e2e/admin/admin-user-pagination.spec.ts',
];

describe('the admin specs state a true reason (#152, #159)', () => {
  it('found the specs — a renamed file would make every assertion vacuous', () => {
    for (const spec of ADMIN_SPECS) {
      assert.ok(
        fs.existsSync(path.join(ROOT, spec)),
        `${spec} is gone. Re-point this test or delete it; silently passing on a missing ` +
          `file is how a guard test stops guarding.`
      );
    }
  });

  for (const spec of ADMIN_SPECS) {
    it(`${path.basename(spec)} does not skip on bare CI again`, () => {
      const src = stripComments(read(spec));
      assert.ok(
        !/test\.skip\(\s*!!process\.env\.CI\s*[,)]/.test(src),
        `${spec} skips on \`!!process.env.CI\`. That is the #152 defect: the local lane sets ` +
          `CI and is the very Docker Supabase the old reason asked for, so the guard fires ` +
          `against the one environment that satisfies it — and the required check reports ` +
          `green having run nothing.`
      );
    });

    it(`${path.basename(spec)} says what is actually wrong`, () => {
      const src = stripComments(read(spec));
      assert.match(
        src,
        /test\.fixme\(/,
        `${spec} no longer marks itself fixme. If #159 landed and these specs really run, ` +
          `delete this assertion deliberately rather than letting it rot.`
      );
      assert.match(
        src,
        /#159/,
        `${spec} must point at #159, or the next reader has a disabled test with no thread ` +
          `back to why. A disabled test nobody can explain is deleted or trusted, and both ` +
          `are wrong.`
      );
      assert.match(
        src,
        /user_profiles\.is_admin|app_metadata/,
        `${spec}'s reason must name the authority mismatch it is actually blocked on. ` +
          `"Skipped in CI" was false for however long it sat there; a vague replacement is ` +
          `the same defect with better manners.`
      );
    });
  }

  it('the comment stripper actually strips — or every assertion below is vacuous', () => {
    assert.equal(
      stripComments(
        "/* test.skip(!!process.env.CI, 'x') */\nconst a = 1;"
      ).trim(),
      'const a = 1;'
    );
    assert.equal(
      stripComments('// test.skip(!!process.env.CI)\nconst b = 2;').trim(),
      'const b = 2;'
    );
    assert.match(
      stripComments("test.skip(!!process.env.CI, 'x');"),
      /test\.skip/
    );
  });

  it('the interim lane flag is gone, not left as dead config', () => {
    // YAML/shell comments, not JS — strip `#` lines so a note about the removed flag
    // does not read as the flag itself.
    const nohash = (t) => t.replace(/(^|\s)#.*$/gm, '');
    const lane = nohash(read('.github/workflows/e2e-local.yml'));
    const forward = nohash(read('scripts/ci/playwright-in-container.sh'));
    for (const [name, src] of [
      ['.github/workflows/e2e-local.yml', lane],
      ['scripts/ci/playwright-in-container.sh', forward],
    ]) {
      assert.ok(
        !src.includes('E2E_LOCAL_SUPABASE'),
        `${name} still sets or forwards E2E_LOCAL_SUPABASE. Nothing reads it: the repair in ` +
          `#159 gates on whether the admin fixture could be seeded (the ` +
          `\`test.skip(!fixture, …)\` pattern in admin-depth.spec.ts), which needs no lane flag.`
      );
    }
  });
});
