/**
 * Every build-time flag that decides whether a control RENDERS must be documented (#135).
 *
 * A fork could complete `FORK-CHECKLIST.md` step 4 and `AUTH-SETUP.md` Parts 3–4 perfectly —
 * OAuth app created, secret in Supabase, provider enabled — and the sign-in buttons still would
 * not exist. `auth-providers.ts` gates them on `NEXT_PUBLIC_AUTH_*_ENABLED`, which default off,
 * and before #135 those two strings appeared in **zero** markdown files in the repo. Nothing
 * failed; the buttons were simply absent, which is the hardest kind of missing documentation to
 * notice.
 *
 * That is the #134 shape one layer out: #134 fixed the workflow not passing the flags, this
 * fixes nobody being told they exist.
 *
 * DERIVED, NOT LISTED. The flag names come from `src/config/auth-providers.ts` at run time, so a
 * third provider added tomorrow is covered without anyone remembering to edit this file. A
 * hardcoded list would pass forever while going quietly out of date — the failure this repo
 * keeps finding in its own gates.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SOURCE = 'src/config/auth-providers.ts';
/** Docs a fork is actually steered to. Both must carry every render flag. */
const FORK_DOCS = ['docs/FORKING.md', 'docs/AUTH-SETUP.md'];

/** The flags `auth-providers.ts` gates rendering on, read from the source itself. */
function renderFlags() {
  const src = read(SOURCE);
  return [
    ...new Set(
      [...src.matchAll(/NEXT_PUBLIC_AUTH_[A-Z0-9_]+/g)].map((m) => m[0])
    ),
  ];
}

describe('the fork docs cover what makes auth controls render (#135)', () => {
  const flags = renderFlags();

  it('found the flags in source — an empty list would pass every assertion below', () => {
    assert.ok(
      flags.length >= 2,
      `only ${flags.length} render flag(s) found in ${SOURCE}; the matcher is stale and ` +
        'this file would certify nothing'
    );
    // They must really gate rendering, not merely be mentioned.
    assert.match(
      read(SOURCE),
      /enabledOAuthProviders|hasOAuthProviders/,
      `${SOURCE} no longer exports the gate these flags feed; re-check what this asserts`
    );
  });

  for (const doc of FORK_DOCS) {
    it(`${doc} documents every render flag`, () => {
      const body = read(doc);
      assert.ok(body.length > 500, `${doc} did not read`);
      const missing = flags.filter((f) => !body.includes(f));
      assert.deepEqual(
        missing,
        [],
        `${doc} never mentions ${missing.join(', ')}. A fork can configure the provider ` +
          `in Supabase, pass every check, and still have no button — because these gate ` +
          `rendering at BUILD time and default off (#135).`
      );
    });
  }

  /**
   * The navigation half. `FORK-CHECKLIST.md` links to `FORKING.md` four times; before #135
   * `FORKING.md` linked back zero times, so a fork entering at FORKING never found the auth
   * walkthrough at all.
   */
  it('FORKING.md points at the step-by-step checklist', () => {
    assert.match(
      read('docs/FORKING.md'),
      /FORK-CHECKLIST\.md/,
      'FORKING.md does not link to FORK-CHECKLIST.md. The link is one-way, so a reader ' +
        'starting at FORKING.md never reaches the auth walkthrough.'
    );
  });

  /**
   * The ordering rule is the point, not the flag. Turning a button on before its secret is
   * live ships a control that cannot succeed — the exact condition `.env.example` warns about
   * and the reason these default off.
   */
  it('both docs state that the flag comes AFTER the secret', () => {
    for (const doc of FORK_DOCS) {
      const body = read(doc);
      assert.match(
        body,
        /only (?:after|AFTER)/,
        `${doc} lists the render flag without saying it must be set only after the ` +
          'provider secret is live'
      );
    }
  });
});
