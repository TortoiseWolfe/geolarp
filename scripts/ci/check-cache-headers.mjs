#!/usr/bin/env node
/**
 * Assert that LIVE production still serves the cache contract a content-hashed
 * build requires (#635).
 *
 * WHY THIS EXISTS. Production has rendered unstyled for returning visitors eight
 * times (#438, #467, #476, #548, #650 and three more). The cause was never a code
 * defect: GitHub Pages serves `max-age=600` for EVERYTHING, so a visitor could hold
 * build A's HTML for ten minutes while the server had only build B's hashed assets.
 *
 * The fix is a cache contract that GitHub Pages cannot express and Cloudflare now
 * applies at the edge:
 *
 *   HTML                 must revalidate  — it is the index of which assets to load
 *   /_next/static/*      one year         — the content hash IS the version
 *
 * THE PROBLEM THIS SCRIPT SOLVES. That contract lives in Cloudflare's dashboard, not
 * in this repository. Nothing in CI would notice if a rule were deleted, a token
 * rotated, or the zone moved — the bug would simply come back, and the next detector
 * would be a human opening a browser and seeing a white page. That is the exact
 * history #635 documents, and it is not monitoring.
 *
 * WHAT IT DOES NOT COVER, so nobody mistakes a green run for more than it is:
 *
 *   - `check-stale-html.mjs` runs against 127.0.0.1 with its own `createServer` and
 *     hardcodes `Cache-Control: max-age=600`. It proves RETENTION works against a
 *     simulated deploy. It never touches the live site and cannot see Cloudflare at
 *     all, so it is NOT a canary for these rules. (#635's body claimed otherwise.)
 *   - `check-retained-assets.mjs` proves retained assets are still reachable. That is
 *     the mitigation; this is the cure. Both matter until HTML already sitting in
 *     visitors' caches has aged out.
 *
 * `immutable` is deliberately NOT asserted on assets: Cloudflare's Browser TTL emits
 * only `max-age`, so requiring it would fail forever on a correct configuration.
 *
 * Usage:
 *   node scripts/ci/check-cache-headers.mjs [base-url]
 *   BASE=https://example.com node scripts/ci/check-cache-headers.mjs
 *
 * Exits 1 if the contract is not being served.
 */

// DEFAULTS TO THIS SITE, NOT THE UPSTREAM TEMPLATE'S. The fallback used to be
// `https://scripthammer.com`, so running this without an argument silently probed a
// DIFFERENT DOMAIN and reported confident results about it — which is exactly what
// happened while the ledger check below was being written. CI always passes the URL
// explicitly (`smoke.yml:127`), so this only ever bit someone running it by hand, in
// the way hardest to notice. Same fork-trap class as the compose service name in #13.
const BASE = (
  process.argv[2] ||
  process.env.BASE ||
  process.env.NEXT_PUBLIC_DEPLOY_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://geolarp.com'
).replace(/\/$/, '');

/**
 * Documents to check. More than one because the Cloudflare expression matches on
 * `ends_with(path, "/")` — a rule that somehow applied only to the site root would
 * still leave every real page stale, and checking `/` alone could not tell.
 */
const DOC_PATHS = (process.env.CHECK_PATHS ?? '/,/blog/')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

/** Cloudflare Browser TTL for hashed assets, per the #635 Cache Rule. */
const ASSET_MIN_MAX_AGE = Number(process.env.ASSET_MIN_MAX_AGE ?? 31536000);

/**
 * Require proof that Cloudflare answered. The entire contract depends on the edge
 * being in front of GitHub Pages; if `cf-ray` disappears, the origin's own
 * `max-age=600` is what visitors get, and every other assertion here becomes a
 * statement about a machine that is no longer serving the site.
 *
 * Off only for the unit test's local fixture server, never in CI.
 */
const REQUIRE_EDGE = process.env.REQUIRE_EDGE !== 'false';

const failures = [];
const notes = [];
/**
 * Reported, never asserted.
 *
 * `failures` blocks and `blocked` means the probe was refused; neither fits a condition
 * that is real, known, and already mitigated. Without this channel the only options
 * were "fail Production Smoke forever" or "say nothing", and the second is how #84 went
 * unseen for a day.
 */
const warnings = [];

function maxAgeOf(cacheControl) {
  const m = /(?:^|[\s,])max-age\s*=\s*(\d+)/i.exec(cacheControl ?? '');
  return m ? Number(m[1]) : null;
}

/** Does this header force the browser to revalidate before reusing the body? */
function revalidates(cacheControl) {
  const cc = (cacheControl ?? '').toLowerCase();
  if (/\bno-store\b/.test(cc)) return true;
  if (/\bno-cache\b/.test(cc)) return true;
  const age = maxAgeOf(cc);
  return age === 0;
}

/**
 * The header that lets this prober past the edge's bot checks (#10).
 *
 * THIS HEADER DOES NOT CURRENTLY DO ANYTHING, and the reason is worth keeping.
 *
 * Cloudflare answered GitHub Actions runners with 403. The intended fix was a WAF
 * custom rule skipping bot checks for requests carrying this header — narrow,
 * rotatable, revocable. It was built, and it could never have worked.
 *
 * A diagnostic run from an actual runner showed `cf-mitigated: challenge`,
 * IDENTICALLY with and without the header. That is Bot Fight Mode, which on the
 * free plan runs OUTSIDE the rules engine and cannot be skipped by a WAF custom
 * rule at any `products` setting. The rule matched nothing and was deleted.
 *
 * What actually unblocked the probe is an IP Access Rule allowing GitHub's ASN
 * (AS8075), which does bypass Bot Fight Mode. That exempts all of Microsoft Azure
 * from BFM on this zone — broader than a header, and the trade was accepted only
 * after the narrow option was proven impossible. It is still strictly NARROWER
 * than the alternative of disabling Bot Fight Mode zone-wide, which is the only
 * other lever the free plan offers.
 *
 * The header is kept because it costs nothing and becomes the right mechanism the
 * day this zone moves to a plan where bot management is rule-addressable — at
 * which point the ASN allow should go. Until then, do not read its presence as
 * the thing granting access.
 *
 * ABSENT IS A SUPPORTED STATE. A fork with no `CF_PROBE_TOKEN` sends no header and
 * behaves exactly as before, including the UNASSESSABLE path below — whose whole
 * job is to be honest when the probe cannot see, rather than to accuse the cache
 * contract of something it did not do.
 */
const PROBE_TOKEN = process.env.CF_PROBE_TOKEN || '';
const PROBE_HEADER = 'x-geolarp-probe';

async function head(url, extraHeaders = {}) {
  // GET, not HEAD: some edges answer HEAD from a different path than the real
  // request, and the header under test is the one a browser actually receives.
  //
  // EVERY request in this file goes through here, including the ledger reads added
  // for #84. That is not tidiness — `CF_PROBE_TOKEN` is what gets this check past
  // Cloudflare's 403 of runner IPs (#10), and a raw `fetch` elsewhere would be
  // refused while the rest of the check sailed through. `check-cache-headers.test.js`
  // asserts every request carries the header, and it caught exactly that mistake.
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      ...(PROBE_TOKEN ? { [PROBE_HEADER]: PROBE_TOKEN } : {}),
      ...extraHeaders,
    },
  });
  return {
    status: res.status,
    cacheControl: res.headers.get('cache-control'),
    cfRay: res.headers.get('cf-ray'),
    cacheStatus: (res.headers.get('cf-cache-status') ?? '').toUpperCase(),
    age: res.headers.get('age'),
    body: res,
  };
}

/**
 * "THE EDGE REFUSED ME" IS NOT "THE CACHE CONTRACT BROKE".
 *
 * Cloudflare answers GitHub Actions runner IPs with 403 (#10). This check then
 * reported three cache-contract failures — two 403s and, downstream of them, a
 * missing-assets error — under the banner "production has served unstyled
 * pages eight times from exactly this". Every word of that was wrong: the
 * contract was intact the whole time, and verifiable from any unblocked
 * network in one curl.
 *
 * That matters more here than almost anywhere, because this is the ONLY check
 * that can see the #635 cure — the Cloudflare rules live in a dashboard rather
 * than in this repo. A guard that cries the loudest possible wolf for six days
 * over something else is the guard nobody reads on the day it is right.
 *
 * So a refusal is tracked separately and named for what it is. It still exits
 * non-zero, because a check that could not measure must never report green —
 * the same distinction `set-auth-config.ts --check` draws between drift that
 * is actionable and drift that is merely unassessable.
 */
const BLOCKED_STATUSES = new Set([401, 403, 407, 429, 451]);
const blocked = [];

function noteBlocked(url, status) {
  blocked.push(
    `${url} returned ${status}: the edge refused this prober, so the cache ` +
      `contract could not be read. This is NOT evidence the contract broke. ` +
      (PROBE_TOKEN
        ? `CF_PROBE_TOKEN was sent, so either the WAF skip rule is gone or its ` +
          `value no longer matches this secret. `
        : `CF_PROBE_TOKEN is unset, so no skip header was sent. `) +
      `See #10 — Cloudflare 403s GitHub Actions runner IPs, while the same URL ` +
      `answers 200 with the right headers from an ordinary network.`
  );
}

// ── documents must revalidate ────────────────────────────────────────────────
let html = '';
for (const path of DOC_PATHS) {
  const url = `${BASE}${path}`;
  let res;
  try {
    res = await head(url);
  } catch (err) {
    failures.push(`${url} could not be fetched: ${err.message}`);
    continue;
  }

  if (BLOCKED_STATUSES.has(res.status)) {
    noteBlocked(url, res.status);
    continue;
  }

  if (res.status !== 200) {
    failures.push(`${url} returned ${res.status}, expected 200`);
    continue;
  }

  if (path === DOC_PATHS[0]) html = await res.body.text();

  if (!revalidates(res.cacheControl)) {
    const age = maxAgeOf(res.cacheControl);
    failures.push(
      `${url} serves \`cache-control: ${res.cacheControl}\` — the document does ` +
        `not revalidate` +
        (age !== null ? `, so a visitor may reuse it for ${age}s` : '') +
        `. A visitor holding this HTML across a deploy renders unstyled (#635). ` +
        `Expected no-cache. If this reads exactly \`max-age=600\`, the Cloudflare ` +
        `Response Header Transform Rule is missing and GitHub Pages' own header is ` +
        `reaching browsers.`
    );
  } else {
    notes.push(`${path} → ${res.cacheControl}`);
  }

  if (REQUIRE_EDGE && !res.cfRay) {
    failures.push(
      `${url} carries no \`cf-ray\` header, so Cloudflare did not serve it. The ` +
        `cache contract is applied at the edge; without the edge, the origin's ` +
        `max-age=600 is what visitors get.`
    );
  }
}

// ── hashed assets must be immutable-in-practice ──────────────────────────────
const assets = [
  ...new Set(
    Array.from(
      html.matchAll(
        /["'(]([^"'()\s]*\/_next\/static\/[^"'()\s]+?\.(?:js|css))/g
      ),
      (m) => m[1]
    )
  ),
];

// A page that yielded no assets makes every assertion below vacuous — the shape
// this repo keeps getting bitten by (#396). Say so instead of passing silently.
if (assets.length === 0 && blocked.length > 0) {
  // A CONSEQUENCE, NOT A SECOND FINDING. There are no asset URLs because the
  // body was a block page rather than the site. Reporting it separately turned
  // one cause into three errors and buried the one that mattered.
  blocked.push(
    `the asset half of this check did not run: ${BASE}${DOC_PATHS[0]} could ` +
      `not be read, so there was no HTML to find /_next/static/ URLs in.`
  );
} else if (assets.length === 0) {
  failures.push(
    `no /_next/static/ asset URLs were found in ${BASE}${DOC_PATHS[0]}, so the ` +
      `asset half of this check could not run. Either the page failed to render ` +
      `or the asset path convention changed; both need a human.`
  );
} else {
  const rel = assets[0];
  const url = rel.startsWith('http')
    ? rel
    : `${BASE}/${rel.replace(/^\/+/, '')}`;
  try {
    const res = await head(url);
    if (BLOCKED_STATUSES.has(res.status)) {
      noteBlocked(url, res.status);
    } else if (res.status !== 200) {
      failures.push(`${url} returned ${res.status}, expected 200`);
    } else {
      const age = maxAgeOf(res.cacheControl);
      if (age === null || age < ASSET_MIN_MAX_AGE) {
        failures.push(
          `${url} serves \`cache-control: ${res.cacheControl}\` — expected ` +
            `max-age >= ${ASSET_MIN_MAX_AGE}. The filename carries the content ` +
            `hash, so re-downloading it every ${age ?? '?'}s is waste the #635 ` +
            `Cache Rule exists to remove.`
        );
      } else {
        notes.push(`${rel} → ${res.cacheControl}`);
      }
      if (REQUIRE_EDGE && !res.cfRay) {
        failures.push(
          `${url} carries no \`cf-ray\`; Cloudflare did not serve it.`
        );
      }
    }
  } catch (err) {
    failures.push(`${url} could not be fetched: ${err.message}`);
  }
}

// ── the retention ledger must be readable FRESH ──────────────────────────────
//
// STRUCTURALLY UNREACHABLE BY THE CHECK ABOVE (#84). The asset half probes one URL
// scraped out of `DOC_PATHS[0]`'s HTML. These two files appear in no HTML — nothing
// links them — so no amount of asset probing would ever have looked at them, which is
// why a live divergence went unseen.
//
// They sit under `/_next/static/`, so the year-long Cache Rule applies to them exactly
// as it does to a content-hashed chunk. For a chunk that is correct: the name changes
// when the bytes do. For a LEDGER it is a defect, because the name never changes and
// the bytes do on every deploy. Measured against production: a plain read returned
// `cf-cache-status: HIT` at `age: 22697` with 175 lines, while a cache-busted read
// returned 171 — the cached copy named build IDs that no longer existed and was
// missing the current build. `retain-previous-assets.mjs` then carried the dead files
// forward and the post-deploy detector reported them missing.
//
// WHAT IS ASSERTED AND WHAT IS ONLY REPORTED. Cache-busting is the mitigation that
// shipped, so THAT is what fails here: if a buster stops producing a fresh read, the
// fix is silently dead and this must go red. The staleness itself is only warned about
// — it is the expected consequence of the Cache Rule, and failing on it would leave
// Production Smoke permanently red for a condition the mitigation already handles.
const LEDGER_PATHS = [
  '/_next/static/ASSET_MANIFEST.txt',
  '/_next/static/ASSET_AGES.txt',
];
const ledgerNonce = `${Date.now()}`;

// ONE CAUSE REPORTS AS ONE PROBLEM. If the edge already refused the document probes,
// it will refuse these too — that is the same block, not two more findings. The asset
// half above takes the same care, and `check-cache-headers.test.js` asserts it: a
// fully-blocked site must report once per probed URL rather than cascading.
const ledgerPaths = blocked.length > 0 ? [] : LEDGER_PATHS;
if (blocked.length > 0) {
  warnings.push(
    'the retention-ledger half of this check did not run: the edge refused the ' +
      'document probes above, so these would only report the same block again.'
  );
}

for (const path of ledgerPaths) {
  const plainUrl = `${BASE}${path}`;
  const freshUrl = `${plainUrl}?cb=${ledgerNonce}`;
  try {
    const [plain, fresh] = await Promise.all([
      head(plainUrl),
      head(freshUrl, { 'cache-control': 'no-cache', pragma: 'no-cache' }),
    ]);

    if (BLOCKED_STATUSES.has(fresh.status)) {
      noteBlocked(freshUrl, fresh.status);
      continue;
    }
    if (fresh.status === 404) {
      // A RAMP STATE, NOT A DEFECT. `retain-previous-assets.mjs` documents it: the
      // first deploy after that script lands has no ledger to read, falls back to
      // crawling, and writes the first one. A fresh fork sits here too. The detector
      // that DOES fail on a broken ledger is `check-retained-assets.mjs`, which reads
      // it and asserts every promised file is served.
      warnings.push(
        `${path} is not published yet (404). Retention will fall back to crawling ` +
          `this deploy and write the first ledger; expected before the first deploy ` +
          `that ships one, and on a fork.`
      );
      continue;
    }
    if (fresh.status !== 200) {
      failures.push(
        `${freshUrl} returned ${fresh.status}, expected 200. The retention ledger ` +
          `must be readable, or every deploy falls back to crawling.`
      );
      continue;
    }

    // THE ASSERTION: a never-before-used nonce must not be served from cache.
    //
    // `cf-cache-status` is the signal, NOT `age`. A first draft asserted `age === 0`
    // and failed against production on a read that was demonstrably fresh: measured,
    // a `MISS` still carries `age: 118` here, reported from tiered caching, while its
    // BODY matched the origin (171 lines) and the plain read did not (175). So `age`
    // describes the edge's own bookkeeping and says nothing about what you were handed.
    //
    // Measured behaviour this rests on: two different nonces both returned MISS with
    // the fresh body, and re-requesting the SAME nonce returned HIT — so the cache key
    // does include the query string, which is the whole reason busting is viable. If
    // Cloudflare ever normalises the query out of the key, every fresh nonce becomes a
    // HIT and this goes red, which is precisely when someone needs to know.
    if (fresh.cacheStatus === 'HIT') {
      failures.push(
        `${freshUrl} was served from cache (\`cf-cache-status: HIT\`) on a nonce ` +
          `never used before. The query string has stopped being part of the cache ` +
          `key, so \`getFresh()\` in retain-previous-assets.mjs is no longer doing ` +
          `anything and the deploy is reading a stale ledger again (#84).`
      );
      continue;
    }

    const plainBody = plain.status === 200 ? await plain.body.text() : null;
    const freshBody = await fresh.body.text();
    const lines = (t) => t.trim().split('\n').filter(Boolean).length;

    if (plainBody !== null && plainBody !== freshBody) {
      // Reported, not asserted — see the note above.
      warnings.push(
        `${path} is STALE at the edge: cached copy has ${lines(plainBody)} line(s) ` +
          `(age ${plain.age ?? '?'}) against ${lines(freshBody)} at origin. Harmless ` +
          `while every reader cache-busts; #84 tracks moving the ledger off the ` +
          `year-long cache path so it stops depending on that.`
      );
    } else {
      notes.push(`${path} → fresh read reaches origin`);
    }
  } catch (err) {
    failures.push(`${freshUrl} could not be fetched: ${err.message}`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`  ok  ${n}`);
for (const w of warnings) console.error(`::warning::${w}`);

if (failures.length > 0) {
  for (const f of failures) console.error(`::error::${f}`);
  console.error(
    `\n${failures.length} cache-contract failure(s) against ${BASE}. ` +
      `See #635 — production has served unstyled pages eight times from exactly this.`
  );
  if (blocked.length > 0) {
    for (const b of blocked) console.error(`::warning::${b}`);
  }
  process.exit(1);
}

if (blocked.length > 0) {
  for (const b of blocked) console.error(`::error::${b}`);
  console.error(
    `\nUNASSESSABLE: ${blocked.length} probe(s) were refused by the edge, so the ` +
      `cache contract at ${BASE} was NOT verified. This is not a failure of the ` +
      `contract and is not evidence of #635 — it is a failure to measure, which ` +
      `is tracked as #10. Confirm by hand from an unblocked network:\n` +
      `  curl -sSI ${BASE}/ | grep -iE 'cache-control|cf-ray'\n` +
      `Exiting non-zero deliberately: a check that could not measure must never ` +
      `report green.`
  );
  process.exit(1);
}

console.log(
  `\ncache contract holds at ${BASE}: documents revalidate, hashed assets cached ` +
    `for >= ${ASSET_MIN_MAX_AGE}s, edge confirmed.`
);
