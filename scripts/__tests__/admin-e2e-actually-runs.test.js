/**
 * The admin specs must actually run, against the real admin authority (#152 → #159).
 *
 * TWO DEFECTS, ONE FILE. First (#152) the specs skipped themselves on `!!process.env.CI`
 * with the reason "requires local Docker Supabase" — true when written, false since #575
 * made the local lane exactly that while setting `CI: 'true'`. The guard fired against the
 * one environment that satisfied it, and the hosted lane sets `CI` too, so 29 tests ran in
 * NEITHER while `E2E (local) result` stayed a required context.
 *
 * Unskipping them exposed the second (#159): they signed in as a hardcoded
 * `test@example.com` and assumed admin-ness came from `app_metadata`. It does not —
 * `user_profiles.is_admin` is "the single authority since #240"
 * (`admin-depth.spec.ts:15-18`). `AdminGate` redirected, rendered `null`, and the first
 * test in each file failed; `mode: 'serial'` then skipped the other 26. Three failures,
 * zero coverage, and the failure looked like a missing element rather than a missing role.
 *
 * WHY THIS MATTERS MORE THAN UNUSED COVERAGE. `/admin` is six routes behind `AdminGate`,
 * and #454 is the scar: `color-contrast.spec.ts` "listed them and measured THE HOME PAGE"
 * six times, because a non-admin is redirected to a clean, AAA-passing home page. Tests
 * that present as admin coverage while measuring nothing are worse than no tests, because
 * the count reassures.
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
 * explanation of the old guard as the old guard. Writing this file without stripping
 * produced three failures against specs that were already fixed — a probe reporting on
 * itself. `fix-boundary.test.ts:64-69` solves the same problem the same way.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ADMIN_SPECS = [
  'tests/e2e/admin/admin-dashboard.spec.ts',
  'tests/e2e/admin/admin-conversation-list.spec.ts',
  'tests/e2e/admin/admin-user-pagination.spec.ts',
];

describe('the admin specs run, as a real admin (#152, #159)', () => {
  it('the comment stripper actually strips — or everything below is vacuous', () => {
    assert.equal(
      stripComments('/* test.skip(!!process.env.CI) */\nconst a = 1;').trim(),
      'const a = 1;'
    );
    assert.equal(
      stripComments('// signInWithPassword here\nconst b = 2;').trim(),
      'const b = 2;'
    );
    assert.match(stripComments('test.skip(!!process.env.CI);'), /test\.skip/);
  });

  it('found the specs — a rename would make every assertion vacuous', () => {
    for (const spec of ADMIN_SPECS) {
      assert.ok(
        fs.existsSync(path.join(ROOT, spec)),
        `${spec} is gone. Re-point this test or delete it deliberately; silently passing ` +
          `on a missing file is how a guard stops guarding.`
      );
    }
  });

  for (const spec of ADMIN_SPECS) {
    const name = path.basename(spec);

    it(`${name} does not skip on bare CI again`, () => {
      assert.ok(
        !/test\.skip\(\s*!!process\.env\.CI\s*[,)]/.test(
          stripComments(read(spec))
        ),
        `${spec} skips on \`!!process.env.CI\`. That is #152: the local lane sets CI and ` +
          `IS the Docker Supabase the old reason asked for, so the guard fires against ` +
          `the one environment that satisfies it and the required check reports green ` +
          `having run nothing.`
      );
    });

    it(`${name} seeds an admin through user_profiles.is_admin`, () => {
      const src = stripComments(read(spec));
      assert.match(
        src,
        /seedIsolatedAdmin\(\)/,
        `${spec} must seed its admin with \`seedIsolatedAdmin()\`, which promotes through ` +
          `\`user_profiles.is_admin\` — the authority since #240 — and refuses to return a ` +
          `fixture whose \`is_admin()\` does not answer true through the user's own session.`
      );
      assert.doesNotMatch(
        src,
        /signInWithPassword\(\s*\{\s*\n?\s*email:\s*ADMIN_EMAIL/,
        `${spec} still signs in as a hardcoded admin account. That account's admin-ness ` +
          `came from \`app_metadata\`, which #240 superseded — AdminGate redirects and the ` +
          `console container never renders (#159).`
      );
    });

    it(`${name} skips at runtime, not at collection`, () => {
      const src = stripComments(read(spec));
      const skip = src.indexOf('test.skip(!fixture');
      assert.notStrictEqual(
        skip,
        -1,
        `${spec} must guard on the fixture, so a stack with no admin client skips ` +
          `honestly instead of failing as a missing element.`
      );
      const hook = src.indexOf('test.beforeEach');
      assert.ok(
        hook !== -1 && skip > hook,
        `${spec} evaluates \`test.skip(!fixture, …)\` outside a hook. In the describe body ` +
          `it runs BEFORE \`beforeAll\` seeds, when fixture is still null — so it would ` +
          `skip every test unconditionally and report green having run nothing. That is ` +
          `the exact failure #159 exists to remove, reintroduced one line higher.`
      );
    });

    it(`${name} navigates to an admin route, not just the home page`, () => {
      // THIS ASSERTION EXISTS BECAUSE I BROKE IT. Rewriting the `beforeEach` for #159
      // deleted `page.goto('/admin/messaging')` from admin-conversation-list, so every
      // test in that file measured the HOME page — and the failure read as "the console
      // container is missing" rather than "we never went there". A spec that only ever
      // visits `/` cannot be testing the admin console, whatever its assertions say.
      //
      // This is #454 in miniature: a clean, populated home page passes far more
      // assertions than it should.
      const src = stripComments(read(spec));
      assert.match(
        src,
        /page\.goto\(`\$\{BP\}\/admin/,
        `${spec} never navigates to an /admin route. Every assertion in it would be ` +
          `measuring whatever page it happened to be left on — the home page — which is ` +
          `exactly the failure #454 records.`
      );
    });

    it(`${name} derives the basePath instead of hardcoding it`, () => {
      const src = stripComments(read(spec));
      const decl = src.split('\n').find((l) => l.includes('const BP'));
      assert.ok(decl, `${spec} has no BP declaration to check`);
      assert.doesNotMatch(
        decl,
        /=\s*['"`]\//,
        `${spec} hardcodes a basePath: ${decl.trim()}. \`public/CNAME\` means this repo ` +
          `deploys at the apex, so its basePath is '' — a literal '/geoLARP' is the one ` +
          `value it can never have, and every route built from it 404s. CLAUDE.md records ` +
          `the identical trap for public/manifest.json.`
      );
    });

    it(`${name} cleans up the admin it seeded`, () => {
      assert.match(
        stripComments(read(spec)),
        /deleteIsolatedAdmin\(/,
        `${spec} seeds a throwaway admin and never deletes it. These accumulate in the ` +
          `hosted project, and one of them is an admin.`
      );
    });
  }
});
