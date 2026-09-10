/**
 * No script may DEFAULT to the upstream domain (#133).
 *
 * A fork-inherited base URL is the same defect class as the inherited project ref that
 * `no-inherited-supabase-ref.test.js` guards, one layer out: a gate pointed at somebody
 * else's site. Four scripts carried `https://scripthammer.com` as their fallback. One was
 * already fixed (`check-cache-headers.mjs`, whose comment names the trap); the other three
 * were found by verifying #133 and are fixed here.
 *
 * THEY FAILED IN BOTH DIRECTIONS, and the quiet one is the reason for a test.
 *
 *   check-captcha.mjs         false FAILURE — "site key is NOT in the deployed bundle …
 *                             the workflow must pass it into the build step", naming a
 *                             deploy.yml bug that does not exist
 *   check-retained-assets.mjs false FAILURE — "::error:: the retention ledger is not
 *                             published … the next deploy will strand every visitor"
 *   check-csp-header.mjs      false PASS, exit 0 — "OK — delivered and honoured, in
 *                             report-only mode" about the upstream domain, while
 *                             geolarp.com is ENFORCING with 14 directives against its 11
 *
 * The false pass is the expensive one, and by this repo's own standard it is "the most
 * expensive possible answer: a gate reporting success about a thing it is not looking at".
 *
 * WHY CI NEVER CAUGHT IT. Every workflow passes the URL explicitly —
 * `smoke.yml:101,:127,:143` all run `"${SITE:-https://geolarp.com}"`, and `:-` covers the
 * empty-variable case. So the default only ever bit someone running a script by hand, which
 * is exactly when there is no second opinion.
 *
 * WHY THIS MATCHER IS NARROW. The obvious test — "no `scripthammer.com` anywhere under
 * `scripts/`" — fails on five legitimate explanatory comments, including the one in
 * `check-cache-headers.mjs` that documents this very trap and the ones added by the fix. A
 * test that forbids describing a bug is a test that gets deleted. So this looks only at
 * DEFAULT EXPRESSIONS: a literal reached via `||`, `??`, or an `arg()`/env fallback, with
 * comment lines stripped first.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'scripts');

/** Domains this repo must never silently fall back to. Add, never remove. */
const UPSTREAM = ['scripthammer.com'];

/** Every .mjs/.js under scripts/, excluding the tests themselves. */
function scriptFiles(dir = SCRIPTS) {
  const out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...scriptFiles(full));
      continue;
    }
    if (/\.(mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Comments are prose, not defaults.
 *
 * Written because the first version of this test failed on the comment that documents
 * the bug. A gate that cannot tell code from an explanation of the code is one that will
 * be weakened until it passes — the same note `coarse-fix.test.js` carries.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const FILES = scriptFiles();

describe('no script defaults to the upstream domain (#133)', () => {
  it('scans a real number of scripts — a silent zero is not a pass', () => {
    assert.ok(
      FILES.length > 20,
      `only ${FILES.length} scripts found; the walker is broken and every assertion ` +
        'below would pass vacuously'
    );
  });

  it('the comment stripper does not eat code', () => {
    // The control. A stripper that returned '' would make this file certify nothing.
    const src =
      "const a = 1; // https://scripthammer.com in a comment\nconst b = 'x';";
    const out = stripComments(src);
    assert.match(out, /const a = 1;/);
    assert.match(out, /const b = 'x';/);
    assert.ok(!out.includes('scripthammer.com'));
    // And it must NOT strip a URL inside a string literal, or a real default could hide
    // behind one.
    assert.match(
      stripComments("const u = 'https://scripthammer.com';"),
      /scripthammer\.com/
    );
  });

  for (const domain of UPSTREAM) {
    it(`no fallback expression resolves to ${domain}`, () => {
      const offenders = [];
      for (const file of FILES) {
        // COLLAPSED TO ONE LINE FIRST, and that is not cosmetic. A line-by-line
        // matcher missed the very shape this fix introduces: the corrected chains are
        // MULTI-LINE, so the `||` and the literal sit on different lines and a
        // per-line test sees neither together. Found by the negative control below —
        // reverting a default reddened only the by-name assertion, never the general
        // one, which is precisely the case that has to catch a NEW offender.
        const code = stripComments(fs.readFileSync(file, 'utf8')).replace(
          /\s+/g,
          ' '
        );
        // A default is a literal reached through a fallback operator or an
        // arg()/env-style helper, within one expression. A URL used as an explicit,
        // deliberate target is not.
        const re = new RegExp(
          `(\\|\\||\\?\\?|arg\\s*\\()[^;]{0,240}${domain.replace('.', '\\.')}`,
          'g'
        );
        for (const m of code.matchAll(re)) {
          offenders.push(`${path.relative(ROOT, file)}: …${m[0].slice(-90)}`);
        }
      }
      assert.deepEqual(
        offenders,
        [],
        `a script falls back to ${domain}. Run by hand without an argument it reports ` +
          `confident results about a DIFFERENT SITE — a false failure at best, and at ` +
          `worst a green run about somebody else's domain. Use the chain in ` +
          `scripts/ci/check-cache-headers.mjs:49-55 instead.\n  ` +
          offenders.join('\n  ')
      );
    });
  }

  /**
   * The four known members, pinned by name. The set assertion above catches a NEW
   * offender; this catches a silent revert of a fixed one, which the set cannot
   * distinguish from a file that never had the bug.
   */
  it('the four known scripts resolve to this project', () => {
    const KNOWN = [
      'scripts/check-captcha.mjs',
      'scripts/ci/check-csp-header.mjs',
      'scripts/ci/check-retained-assets.mjs',
      'scripts/ci/check-cache-headers.mjs',
    ];
    for (const rel of KNOWN) {
      const full = path.join(ROOT, rel);
      assert.ok(fs.existsSync(full), `${rel} is gone; this list is stale`);
      const code = stripComments(fs.readFileSync(full, 'utf8'));
      assert.match(
        code,
        /'https:\/\/geolarp\.com'/,
        `${rel} no longer defaults to this project's own domain`
      );
    }
  });
});
