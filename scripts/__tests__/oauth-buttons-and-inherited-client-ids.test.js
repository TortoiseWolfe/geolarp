/**
 * The OAuth buttons could never render, and the fix for that arms a second trap (#134).
 *
 * PART ONE. `auth-providers.ts:33,36` reads `NEXT_PUBLIC_AUTH_GITHUB_ENABLED` /
 * `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`, and `OAuthButtons.tsx:70` is literally
 * `if (providers.length === 0) return null`. These are build-time values in a static
 * export, and NO workflow passed either one — `git grep NEXT_PUBLIC_AUTH_ -- .github/`
 * returned nothing. So the buttons were permanently absent in production whatever was
 * configured on the Supabase side, and nothing failed to explain it.
 *
 * The obvious next step after obtaining OAuth credentials — set the Supabase secrets,
 * set the client ids — therefore produced working providers and invisible buttons.
 *
 * PART TWO, which only becomes reachable once part one is fixed. `auth-config.json`
 * pins default client ids, deliberately: the drift gate needs a committed expectation
 * or both sides could drift together and it could never fire (#287). But geoLARP's
 * defaults are BYTE-IDENTICAL to ScriptHammer's and arrived in the `Initial commit` —
 * inherited by the fork, never obtained for this project. Verified:
 *
 *   $ diff <(grep client_id ~/repos/ScriptHammer/scripts/supabase/auth-config.json) \
 *          <(grep client_id scripts/supabase/auth-config.json)     # identical
 *   $ git log --oneline -S 988747852237 -- scripts/supabase/auth-config.json
 *   1a37740d Initial commit
 *
 * `set-auth-config.ts` withholds a provider only while its SECRET is missing. The
 * moment a real secret appears, the withhold lifts and `--apply` would write THIS
 * project's secret against ANOTHER project's client id: `invalid_client` on every
 * sign-in, with the config reading as fully configured. That is the same
 * "looks configured, nobody can sign in" shape the withhold exists to prevent,
 * arrived at from the opposite direction.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const DEPLOY = '.github/workflows/deploy.yml';
const SETTER = 'scripts/supabase/set-auth-config.ts';
const CONFIG = 'scripts/supabase/auth-config.json';

const PROVIDERS = [
  { name: 'github', flag: 'NEXT_PUBLIC_AUTH_GITHUB_ENABLED' },
  { name: 'google', flag: 'NEXT_PUBLIC_AUTH_GOOGLE_ENABLED' },
];

describe('the OAuth buttons can render at all (#134)', () => {
  const wf = read(DEPLOY);

  it('found the workflow and its build step — a silent miss is not a pass', () => {
    assert.ok(wf.length > 2000, 'deploy.yml did not read');
    assert.match(
      wf,
      /Build Next\.js app/,
      'the build step was renamed; matchers stale'
    );
  });

  for (const { name, flag } of PROVIDERS) {
    it(`deploy.yml passes ${flag} into the build`, () => {
      assert.match(
        wf,
        new RegExp(`^\\s*${flag}:`, 'm'),
        `deploy.yml does not pass ${flag}, so the ${name} button can never render ` +
          `in production regardless of what is configured on Supabase — and nothing ` +
          `anywhere fails to say so (#134)`
      );
    });

    it(`${flag} comes from vars, not secrets`, () => {
      // It ships in the page HTML. A secret would be pointlessly redacted in logs
      // while being world-readable in the bundle, and the Secrets/Variables split is
      // load-bearing here: on the wrong tab it arrives as an empty string, silently
      // falsy, and the button vanishes again with no error (#36).
      assert.match(
        wf,
        new RegExp(`${flag}:\\s*\\$\\{\\{\\s*vars\\.${flag}\\s*\\}\\}`),
        `${flag} must read from vars.*`
      );
    });
  }

  /**
   * The flags must stay DEFAULT-OFF. `enabled()` accepts only 'true'/'1', so unset is
   * off — that is what makes a fork safe, and what lets the owner turn a provider on
   * only after its secret is live. A hardcoded `true` here would ship a button that
   * cannot succeed, which is the condition `.env.example:433-438` describes.
   */
  it('neither flag is hardcoded on in the workflow', () => {
    for (const { flag } of PROVIDERS) {
      assert.ok(
        !new RegExp(`${flag}:\\s*'?(true|1)'?\\s*$`, 'm').test(wf),
        `${flag} is hardcoded on in deploy.yml. It must come from a repo Variable so ` +
          `it can be turned on only after the provider secret is live.`
      );
    }
  });
});

describe('an inherited client id cannot be paired with a real secret (#134)', () => {
  const setter = read(SETTER);
  const config = read(CONFIG);

  it('found both files and the OAuth rules', () => {
    assert.ok(setter.length > 2000 && config.length > 500);
    assert.match(setter, /label: 'Google OAuth'/);
    assert.match(setter, /label: 'GitHub OAuth'/);
  });

  /**
   * Every OAuth rule must declare BOTH halves. One without the other is a guard that
   * silently never fires — the failure mode this whole file is about.
   */
  it('every rule naming a client-id field also names its inherited value', () => {
    const clientIdFields = [
      ...setter.matchAll(/clientIdField:\s*'([^']+)'/g),
    ].map((m) => m[1]);
    const inherited = [
      ...setter.matchAll(/inheritedClientId:\s*\n?\s*'([^']+)'/g),
    ].map((m) => m[1]);
    assert.equal(
      clientIdFields.length,
      2,
      `expected a clientIdField on both OAuth rules, found ${clientIdFields.length}`
    );
    assert.equal(
      inherited.length,
      clientIdFields.length,
      'an OAuth rule declares clientIdField without inheritedClientId, so its guard ' +
        'can never fire'
    );
    for (const v of inherited)
      assert.ok(v.length > 10, `implausible client id: ${v}`);
  });

  /**
   * THE LINKAGE, and the assertion that will one day fail on purpose.
   *
   * While `auth-config.json` still defaults to an inherited id, the guard must know
   * that exact string or it cannot fire. If you have just replaced a default with a
   * client id genuinely created for THIS project, this test will fail — and the
   * correct response is NOT to copy the new value into `inheritedClientId`. That
   * constant is historical: it names the value that must never be paired with a real
   * secret. Update this test to stop expecting the linkage for that provider instead.
   */
  it('the guard knows every inherited default still present in auth-config.json', () => {
    const inherited = [
      ...setter.matchAll(/inheritedClientId:\s*\n?\s*'([^']+)'/g),
    ].map((m) => m[1]);
    for (const { name } of PROVIDERS) {
      const m = config.match(
        new RegExp(
          `"external_${name}_client_id":\\s*"\\$\\{[A-Z_]+:-([^}"]+)\\}"`
        )
      );
      assert.ok(m, `no defaulted client id found for ${name} in ${CONFIG}`);
      const defaulted = m[1];
      assert.ok(
        inherited.includes(defaulted),
        `${CONFIG} defaults external_${name}_client_id to "${defaulted}", which the ` +
          `guard in ${SETTER} does not recognise. Either that value is inherited and ` +
          `the guard must name it, or it was created for this project — in which ` +
          `case remove this expectation for ${name} rather than widening the guard.`
      );
    }
  });

  /**
   * The guard has to sit BEFORE the secret is attached. After it, the trap has
   * already sprung: the patch would carry both the secret and the wrong client id.
   */
  it('fires before the secret is attached, not after', () => {
    const guardAt = setter.indexOf('inherited from upstream');
    const attachAt = setter.indexOf('patch[rule.secretField] = secret;');
    assert.ok(guardAt > 0, 'the inherited-client-id guard is gone');
    assert.ok(attachAt > 0, 'the secret attachment is gone; matchers stale');
    assert.ok(
      guardAt < attachAt,
      'the guard runs AFTER the secret is attached, so the patch already pairs this ' +
        "project's secret with another project's client id"
    );
  });
});
