/**
 * `SUPABASE_PROJECT_REF` is a VARIABLE, and the docs must not say otherwise (#36).
 *
 * CLAUDE.md opens its GitHub-config section by warning that the Secrets/Variables
 * split is load-bearing: "Put them in Secrets and nothing errors — they arrive as
 * empty strings, the deploy goes green, and the bundle ships with no backend."
 * Then its own Variables list omitted the one variable a workflow reads by that
 * exact name, while `auth-config-drift.yml`'s header called it a Secret. Anyone
 * following the header put it on the wrong tab and got the silent failure the
 * section exists to prevent — plausibly the whole cause of #9.
 *
 * THE TWO NAMES ARE THE TRAP, and they defeat a naive check.
 * `NEXT_PUBLIC_SUPABASE_PROJECT_REF` is the LOCAL `.env` name and CONTAINS
 * `SUPABASE_PROJECT_REF` as a substring, so a plain `includes()` reports the CI
 * variable as documented when only the local one is present. That is exactly how
 * the first audit of this mis-scored it. Every match here is anchored so the
 * prefixed name cannot satisfy it.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Matches the bare name only — `_` is a word character, so `\b` rejects the prefixed form. */
const BARE = /(^|[^_A-Za-z0-9])SUPABASE_PROJECT_REF/;

describe('SUPABASE_PROJECT_REF is documented as a Variable', () => {
  it('the anchor can tell the two names apart', () => {
    // The control. Without it, a BARE that matched the prefixed name would make
    // every assertion below pass while documenting the wrong variable.
    assert.ok(!BARE.test('NEXT_PUBLIC_SUPABASE_PROJECT_REF=abc'));
    assert.ok(BARE.test('SUPABASE_PROJECT_REF=abc'));
    assert.ok(BARE.test('vars.SUPABASE_PROJECT_REF'));
  });

  it('a workflow really does read it from vars — else this file is obsolete', () => {
    const wf = read('.github/workflows/auth-config-drift.yml');
    assert.match(
      wf,
      /vars\.SUPABASE_PROJECT_REF/,
      'nothing reads vars.SUPABASE_PROJECT_REF any more; delete this file'
    );
  });

  it('CLAUDE.md names it, and not merely via the NEXT_PUBLIC_ form', () => {
    const md = read('CLAUDE.md');
    assert.ok(
      BARE.test(md),
      'CLAUDE.md does not name the bare SUPABASE_PROJECT_REF. If it only shows ' +
        'NEXT_PUBLIC_SUPABASE_PROJECT_REF, the CI variable is still undocumented ' +
        'and the wrong-tab failure is still one step away (#36).'
    );
  });

  it('auth-config-drift.yml does not call it a Secret', () => {
    const wf = read('.github/workflows/auth-config-drift.yml');
    assert.doesNotMatch(
      wf,
      /Secrets already exist in the repo \(SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF\)/,
      'the header lists the ref among the Secrets again'
    );
    assert.match(
      wf,
      /SUPABASE_PROJECT_REF \(a VARIABLE\)/,
      'the header no longer states which tab the ref belongs on'
    );
  });

  it('CI-SETUP.md distinguishes the local name from the CI variable', () => {
    const doc = read('docs/testing/CI-SETUP.md');
    assert.match(doc, /NEXT_PUBLIC_SUPABASE_PROJECT_REF/);
    assert.ok(
      BARE.test(doc),
      'CI-SETUP.md documents only the local NEXT_PUBLIC_ name, so a reader ' +
        'setting up CI never learns the variable is called something else'
    );
  });
});
