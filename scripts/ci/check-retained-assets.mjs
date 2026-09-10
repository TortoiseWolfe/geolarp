#!/usr/bin/env node
/**
 * Assert that LIVE production still serves every asset it promised to retain.
 *
 * WHY THIS EXISTS. Production has gone unstyled seven times — #438, #467, #476,
 * #548, #650 and twice since. Every single time the detector was a human opening
 * a browser and seeing a white page with a giant logo. That is not monitoring.
 *
 * The failure is invisible to everything already in place:
 *
 *   - The post-deploy @smoke suite fetches the CURRENT HTML, whose CSS is always
 *     fresh by construction. It cannot see the problem.
 *   - `check-stale-html.mjs` proves retention works, but against a SIMULATED
 *     deploy in CI. It never touches the real site.
 *   - `retain-previous-assets.mjs` reports "retained 40 asset(s)" and is believed.
 *     Nothing verifies those 40 are actually reachable afterwards.
 *
 * So the promise ("a visitor holding older HTML still resolves its stylesheets")
 * has never once been checked against reality.
 *
 * WHAT THIS CHECKS. `_next/static/ASSET_MANIFEST.txt` is written by the deploy and
 * lists every file that build published PLUS everything carried forward. If an
 * entry in it 404s, then someone holding the HTML that references it is looking at
 * an unstyled page right now. That is the exact user-visible condition, stated as
 * a falsifiable assertion.
 *
 * CSS is reported separately and treated as fatal, because a missing chunk
 * degrades a feature while a missing stylesheet destroys the entire page.
 *
 * Usage:
 *   node scripts/ci/check-retained-assets.mjs [base-url]
 *   BASE=https://scripthammer.com node scripts/ci/check-retained-assets.mjs
 *
 * Exits 1 if any retained asset is gone.
 */

const BASE = (
  process.argv[2] ||
  process.env.BASE ||
  'https://geolarp.com'
).replace(/\/$/, '');
const MANIFEST = `${BASE}/_next/static/ASSET_MANIFEST.txt`;
const AGES = `${BASE}/_next/static/ASSET_AGES.txt`;
const CONCURRENCY = 12;

/** Must match `RETAIN_DAYS` in .github/workflows/deploy.yml (#751). */
const RETAIN_DAYS = Number(process.env.RETAIN_DAYS ?? 14);

/**
 * When the day-based ledger shipped (#751).
 *
 * A freshly-retimed ledger spans zero days and widens by about a day per day, so a
 * short span means "ramping" for the first RETAIN_DAYS and "collapsed" ever after.
 * Nothing IN the ledger can tell those apart — both look like recent timestamps —
 * so the window floor stays dormant until enough wall-clock time has passed for a
 * healthy ledger to have filled. Failing during the ramp would train people to
 * ignore this check in the two weeks before it can first mean anything.
 *
 * Overridable ONLY so the floor can be exercised before the ramp elapses — a check
 * nobody has seen go red is not yet a check, and this one is dormant by design for
 * its first two weeks. Nothing in CI sets it.
 */
const RETIMED_AT = Date.parse(
  process.env.RETENTION_RETIMED_AT ?? '2026-08-15T00:00:00Z'
);

/**
 * HEAD, falling back to a ranged GET whenever HEAD cannot prove the asset is
 * served. Some CDNs reject HEAD while serving GET, and a valid ranged response
 * is commonly 206 rather than 200.
 */
async function status(url) {
  let head;
  try {
    head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (head.ok) return { ok: true, code: head.status };
  } catch {
    // Try GET below: a CDN can reject or close a HEAD request while serving the
    // exact same asset normally.
  }

  try {
    const get = await fetch(url, {
      headers: { range: 'bytes=0-0' },
      redirect: 'follow',
    });
    return { ok: get.ok, code: get.status };
  } catch (err) {
    return {
      ok: false,
      code: head ? head.status : `ERR ${err.message}`,
    };
  }
}

async function pool(items, worker, size) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await worker(items[idx]);
      }
    })
  );
  return out;
}


/**
 * Read a ledger file, never from a cache (#128).
 *
 * BOTH LEDGERS LIVE UNDER `/_next/static/`, which the edge caches for a YEAR by design —
 * that year-long rule is the whole point of the content-hashed asset path, and these two
 * files are the one thing beneath it that must never be stale. This script used a plain
 * `fetch()`, so it asserted a cached PROMISE against the CURRENT site and its verdict became
 * a function of which edge node answered.
 *
 * `retain-previous-assets.mjs:94` already solved this for the deploy side (#84). The same
 * two files are read here and were never converted; #84 closed with this half unfixed.
 *
 * Reproduced against production: the cached manifest held 175 entries, the fresh one 244
 * (`cf-cache-status: HIT`, `age: 186632` — 2.2 days). Two entries present only in the cached
 * copy 404'd, and the script reported them as stranded assets. They were not: the deploy had
 * legitimately stopped promising them.
 *
 * IT FAILS BOTH WAYS, and the silent direction is worse. A cached manifest is an older,
 * SMALLER list — 175 against 244 — so checking it validates 69 fewer assets than the deploy
 * actually promised. A genuinely stranded file among those 69 is invisible while the script
 * prints a confident "all reachable". That is the exact failure this family of checks exists
 * to prevent, and it produces a green run.
 *
 * A query string is enough: the `?cb=` variant measures `cf-cache-status: MISS`, `age: 0`.
 * `cache: 'no-store'` is sent too but NOT relied on — undici honours it inconsistently, and a
 * header a proxy may ignore is not a guarantee. The buster is the mechanism.
 */
function ledgerUrl(url) {
  return `${url}${url.includes('?') ? '&' : '?'}cb=${LEDGER_NONCE}`;
}

/** One nonce per run, so the manifest and the ages ledger are consistent with each other. */
const LEDGER_NONCE = `${Date.now()}`;

const NO_CACHE = {
  redirect: 'follow',
  cache: 'no-store',
  headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
};

const res = await fetch(ledgerUrl(MANIFEST), NO_CACHE);
if (!res.ok) {
  // A missing manifest is itself the bug: retention has no memory, so the NEXT
  // deploy carries nothing forward and the failure recurs.
  console.error(
    `::error::${MANIFEST} returned ${res.status}. The retention ledger is not ` +
      `published, so nothing is being carried forward and the next deploy will ` +
      `strand every visitor holding current HTML.`
  );
  process.exit(1);
}

const entries = (await res.text())
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

// A manifest that parsed to nothing would make every assertion below vacuous —
// the shape this repo keeps getting bitten by (#396).
if (entries.length < 20) {
  console.error(
    `::error::manifest parsed to only ${entries.length} entries. Expected the ` +
      `full published set; a near-empty manifest makes this check meaningless.`
  );
  process.exit(1);
}

const results = await pool(
  entries,
  async (rel) => {
    const url = `${BASE}/${rel.replace(/^\/+/, '')}`;
    return { rel, url, ...(await status(url)) };
  },
  CONCURRENCY
);

const missing = results.filter((r) => !r.ok);
const missingCss = missing.filter((r) => r.rel.endsWith('.css'));

console.log(`  base      ${BASE}`);
console.log(`  manifest  ${entries.length} entries`);
console.log(`  reachable ${results.length - missing.length}`);
console.log(
  `  MISSING   ${missing.length}  (of which CSS: ${missingCss.length})`
);

if (missing.length) {
  console.log('');
  for (const m of missing.slice(0, 40)) console.log(`   ${m.code}  ${m.rel}`);
  if (missing.length > 40) console.log(`   … and ${missing.length - 40} more`);
  console.error(
    `\n::error::${missing.length} retained asset(s) are gone from ${BASE}` +
      (missingCss.length
        ? ` — ${missingCss.length} of them STYLESHEETS. Anyone holding HTML that ` +
          `references them is seeing an unstyled page right now.`
        : '.')
  );
  process.exit(1);
}

/**
 * IS THE PROMISE WIDE ENOUGH? (#751)
 *
 * Everything above asks whether the retained files are reachable. All 13 stylesheets
 * were, on the night production went unstyled for the eighth time — the check was
 * green and correct, and the window it was vouching for had quietly shrunk to about
 * three and a half days because the cap counted deploys instead of days.
 *
 * So this asks the other question, the one nothing asked: does the ledger actually
 * span the coverage we intend to sell? A window that has collapsed passes every
 * reachability assertion ever written, which is precisely why it needs its own.
 *
 * Ramp: a freshly-retimed ledger legitimately spans zero days, and grows by roughly a
 * day per day. Failing during that would be crying wolf on a correct deploy, so the
 * floor only applies once the ledger is old enough to have reached full width.
 */
const agesRes = await fetch(ledgerUrl(AGES), NO_CACHE);
if (!agesRes.ok) {
  console.error(
    `::error::${AGES} returned ${agesRes.status}. Without the age ledger the next ` +
      `deploy cannot date what it carries, so retention silently restarts.`
  );
  process.exit(1);
}

const dated = [];
for (const line of (await agesRes.text()).split('\n')) {
  const m = line.trim().match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
  if (m) {
    const t = Date.parse(m[2]);
    if (Number.isFinite(t)) dated.push(t);
  }
}

if (!dated.length) {
  console.log(
    `\n  age ledger carries no timestamps yet — pre-#751 format, still ramping. ` +
      `Window unverifiable until the next deploy.`
  );
} else {
  const now = Date.now();
  const spanDays = (now - Math.min(...dated)) / 86_400_000;
  const rampDaysElapsed = (now - RETIMED_AT) / 86_400_000;
  console.log(
    `\n  window    ${spanDays.toFixed(1)} day(s) of coverage, target ${RETAIN_DAYS}`
  );

  // WHAT THIS NUMBER ACTUALLY MEASURES, AND WHY IT IS NO LONGER FATAL (#82).
  //
  // It reads as "how many days of coverage do we have". It is not. `firstSeen` is
  // re-stamped to NOW for every file the new build reproduces (`retain-previous-
  // assets.mjs` continues out of the `alreadyPresent` branch before writing it), so
  // the oldest stamp belongs to the last file that STOPPED being published. The span
  // is therefore a deploy-cadence statistic:
  //
  //     span = D * floor(RETAIN_DAYS / D)      for a deploy every D days
  //
  // Measured against the real check with synthetic sites where nothing is EVER
  // dropped early: D=1 -> 14.0 pass · D=2 -> 14.0 pass · D=3 -> 12.0 FAIL ·
  // D=5 -> 10.0 FAIL · D=7 -> 14.0 pass · D=8.6 -> 8.6 FAIL. A gate whose verdict
  // turns on whether the deploy interval divides 14 is not measuring the promise.
  //
  // Decisive: replaying this repo's 37 real deploy timestamps through a PERFECT,
  // never-stale ledger with perfect retention still yields 11.6 days, still failing.
  // Nothing was wrong; the metric cannot express the thing it is named after.
  //
  // The re-stamping is NOT the bug, and "fixing" it is a regression — see #82. A
  // stylesheet unchanged for 40 days would then be dropped the instant its hash
  // changes, stranding everyone holding yesterday's HTML. That is the outage this
  // file exists to catch.
  //
  // So the window is reported and NOT asserted. The reachability half above stays
  // fatal, because it is the half that can actually see a stranded visitor. #82
  // rebuilds the real assertion at DEPLOY time, where the previous ledger is still
  // in hand and "was anything dropped while still inside the window" is answerable.
  if (spanDays + 1 >= RETAIN_DAYS) {
    console.log(`  window is at full width.`);
  } else if (rampDaysElapsed < RETAIN_DAYS) {
    console.log(
      `  still ramping (day ${rampDaysElapsed.toFixed(1)} of ${RETAIN_DAYS} since ` +
        `the ledger was retimed) — the floor is not asserted yet.`
    );
  } else {
    console.log(
      `\n::warning::window reads ${spanDays.toFixed(1)} day(s) against a target of ` +
        `${RETAIN_DAYS}. This is REPORTED, NOT ASSERTED — the span tracks deploy ` +
        `cadence rather than coverage, and a healthy chain deploying every 3 days ` +
        `measures 12. See #82 for the assertion that replaces it. Every promised ` +
        `file is reachable, which is the half that can see a stranded visitor.`
    );
  }
}

console.log(
  '\n  OK — every asset the deploy promised to retain is still served.'
);
