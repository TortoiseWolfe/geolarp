/**
 * A doc full of upstream issue numbers must say so at the top (#15).
 *
 * `STATUS.md` declares itself "the single screen-scan view of what's planned, what's shipped,
 * what's broken" and was ScriptHammer's audit dated 2026-05-17 sitting under geoLARP's name. The
 * rebrand changed the H1 and the brand strings; the substance beneath was untouched. It is the
 * first file a human or a primed session opens, so plans get built on it.
 *
 * THE DAMAGE INVERTED WHILE THE TICKET SAT OPEN, exactly as #12's did. When #15 was filed,
 * geoLARP had zero PRs and one issue, so a stray `#89` resolved to nothing — wrong, but inert.
 * Checked 2026-09-10: **all 25 numbers cited in STATUS.md now match a real geoLARP issue or pull
 * request**, and none is the thing meant. `#89` there means upstream's E2E flake round; here it
 * is "the game sends people outdoors alone and has no age concept at all".
 *
 * Bare `#NNN` does not autolink in repository markdown, so nothing renders as a broken link. The
 * damage is entirely semantic, which makes it harder to notice rather than easier — and no gate
 * can catch a number that is real but means something else. A banner is the only honest defence.
 *
 * DELIBERATELY NOT A DELETION. CLAUDE.md's guidance is to mark inherited context as upstream
 * rather than remove it: the Tier tables and stability-hotspot notes describe code that genuinely
 * is in this fork.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Docs known to be inherited, each dense with upstream issue numbers. */
const INHERITED = [
  'STATUS.md',
  'docs/prp-docs/PRP-STATUS.md',
  'docs/STABILITY-TRACKING.md',
];

/** How many `#NNN` references make a file's numbering load-bearing. */
const DENSE = 5;

describe('inherited docs declare whose issue numbers they use (#15)', () => {
  for (const doc of INHERITED) {
    it(`${doc} carries the upstream banner`, () => {
      const body = read(doc);
      assert.ok(body.length > 500, `${doc} did not read`);

      const refs = body.match(/#\d+/g) ?? [];
      assert.ok(
        refs.length >= DENSE,
        `${doc} now cites only ${refs.length} issue numbers. If it was rewritten to be ` +
          `geoLARP's own, drop it from INHERITED rather than keeping a banner that no ` +
          `longer describes it.`
      );

      // The banner must be near the top — a warning below the fold is not a warning.
      const head = body.slice(0, 2000);
      assert.match(
        head,
        /INHERITED FROM SCRIPTHAMMER/,
        `${doc} is dense with #NNN references and does not say whose they are. Every one ` +
          `of them now resolves to a real but unrelated geoLARP issue (#15).`
      );
      assert.match(
        head,
        /TortoiseWolfe\/ScriptHammer/,
        `${doc}'s banner does not name the repository the numbers belong to`
      );
    });
  }

  /**
   * STATUS.md's own header claimed a state that was never this repo's. The banner alone does
   * not fix that: a reader who trusts the top line still learns the wrong thing.
   */
  it("STATUS.md states geoLARP's own position before the inherited material", () => {
    const body = read('STATUS.md');
    const head = body.slice(0, 3000);
    assert.match(
      head,
      /Where geoLARP actually is/,
      'STATUS.md no longer states its own current position above the inherited audit'
    );
    assert.match(head, /Forked from ScriptHammer/);
    assert.doesNotMatch(
      head,
      /Phase 0\.5 \(#48 Three\.js Game\) shipping in PR #95/,
      "STATUS.md's header is back to upstream's snapshot, which describes work that has " +
        'never existed in this repository'
    );
  });

  /**
   * The README advertised two capabilities production does not have. Verified against live
   * config on 2026-09-10: `/auth/v1/settings` reports `email` as the only enabled provider,
   * and `PAYMENT_MODE_EXPECTED` is `none`.
   */
  it('README does not advertise OAuth or payments as live', () => {
    const body = read('README.md');
    assert.doesNotMatch(
      body,
      /It runs at \[geolarp\.com\][^\n]*with OAuth and email sign-in, Stripe and PayPal payments/,
      'README claims OAuth sign-in and payments are live. Both are built and neither is ' +
        'enabled in production (#15).'
    );
    assert.match(
      body,
      /built but not switched on/i,
      'README no longer distinguishes what is live from what is merely built'
    );
  });

  it('the matcher can fail', () => {
    // Without this, a read() returning '' would satisfy every doesNotMatch above.
    assert.throws(() => assert.match('', /INHERITED FROM SCRIPTHAMMER/));
    assert.throws(() =>
      assert.doesNotMatch(
        'INHERITED FROM SCRIPTHAMMER',
        /INHERITED FROM SCRIPTHAMMER/
      )
    );
  });
});
