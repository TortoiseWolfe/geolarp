/**
 * The pagination spec mirrors two numbers it cannot import (#172).
 *
 * `tests/e2e/admin/admin-user-pagination.spec.ts` derives every assertion from the total
 * the page reports, compared against PAGE_SIZE — so a lane with two users asserts the same
 * contract as one with two hundred. That replaced five tests which each asserted ONE branch
 * of the rule and needed 51 seeded users to reach it, which
 * `user_profiles.id REFERENCES auth.users(id)` makes 51 real auth users per shard per run.
 *
 * It cannot import PAGE_SIZE: `src/app/admin/users/page.tsx` is a client component whose
 * import chain pulls in the browser Supabase client. So the value is mirrored — and a
 * mirrored constant that drifts is worse than a hardcoded one, because it reads as derived.
 *
 * This is the guard the spec's own comment points at. Without it that comment is a claim
 * about a file that does not exist, which is the failure mode this repo keeps cataloguing.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const PAGE = 'src/app/admin/users/page.tsx';
const SPEC = 'tests/e2e/admin/admin-user-pagination.spec.ts';
const PAGINATION = 'src/components/molecular/Pagination/Pagination.tsx';

function constValue(src, name) {
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
}

describe('the pagination spec mirrors the page (#172)', () => {
  it('PAGE_SIZE in the spec matches PAGE_SIZE in the page', () => {
    const pageValue = constValue(read(PAGE), 'PAGE_SIZE');
    const specValue = constValue(read(SPEC), 'PAGE_SIZE');
    assert.ok(pageValue, `no PAGE_SIZE found in ${PAGE}`);
    assert.ok(specValue, `no PAGE_SIZE found in ${SPEC}`);
    assert.strictEqual(
      specValue,
      pageValue,
      `${SPEC} mirrors PAGE_SIZE=${specValue} while ${PAGE} uses ${pageValue}. Every ` +
        `assertion in that spec branches on this number, so a drift silently sends every ` +
        `test down the wrong branch — and both branches pass, so nothing would report it.`
    );
  });

  it('the component still hides itself at one page, which is the rule being asserted', () => {
    // The spec asserts `toHaveCount(0)` below the threshold. That is only correct while
    // Pagination returns null — if it ever renders a disabled control instead, the spec
    // is wrong in a way no amount of data would reveal.
    assert.match(
      read(PAGINATION),
      /if\s*\(\s*totalPages\s*<=\s*1\s*\)\s*return null/,
      `${PAGINATION} no longer returns null at a single page. ${SPEC} asserts the control ` +
        `is ABSENT at or below PAGE_SIZE; if it now renders something disabled instead, ` +
        `that assertion is testing the wrong contract.`
    );
  });

  it('the spec reads the total from the page rather than assuming one', () => {
    // The regression that matters: someone "simplifying" this back to a fixed expectation
    // reintroduces the 51-user premise without anyone noticing until CI is red.
    const spec = read(SPEC);
    assert.match(
      spec,
      // Word-boundary, because `/async function readTotal/` alone also matches a renamed
      // `readTotalX` — my first version of this control did not fail when the function was
      // renamed away, which made it a probe that could not report the thing it guards.
      /async function readTotal\s*\(/,
      `${SPEC} no longer derives the total from the page. Every assertion in it is ` +
        `supposed to branch on real data — a fixed expectation puts back the seeded-user ` +
        `requirement #172 removed.`
    );
    assert.match(
      spec,
      /toHaveCount\(0\)/,
      `${SPEC} no longer asserts the absent-pagination branch. That branch is the one the ` +
        `lane is always in, and the one nothing covered before #172.`
    );
  });
});
