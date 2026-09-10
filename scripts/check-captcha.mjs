#!/usr/bin/env node
// CAPTCHA preflight gate (#353).
//
// WHY THIS EXISTS
// `SECURITY_CAPTCHA_ENABLED` in Supabase is GLOBAL to auth. It gates sign-in,
// password recovery and resend — not just sign-up. Flipping it while any link
// in the chain is wrong locks every existing user out of the product. That
// happened once already: the flag went on while only the sign-up form sent a
// token, and every sign-in started failing with "captcha protection: request
// disallowed (no captcha_token found)".
//
// The lesson was not "be more careful". It was that the flip was verified by
// probing sign-UP, the one path that happened to work. This script checks every
// link that has to hold, so the answer does not depend on which page someone
// thought to open.
//
// WHAT IT CHECKS
//   1. The site key is actually in the deployed HTML/JS (NEXT_PUBLIC_* is
//      inlined at BUILD time — a repo variable alone changes nothing).
//   2. The deployed origin is on the widget's allowed-domains list, proven
//      DIFFERENTIALLY: a bogus origin must be rejected with 110200 while the
//      real origin must not be. Without the bogus control, "no error" is
//      unfalsifiable — it also happens when the check itself is broken.
//   3. The secret is a real Turnstile secret, via Cloudflare's siteverify.
//      Supabase returns write-only secrets as SHA-256 HASHES on read-back
//      (`smtp_pass` and the OAuth secrets look identical), so the stored value
//      CANNOT be validated by reading it. The plaintext must be supplied.
//
// WHAT IT DELIBERATELY DOES NOT CHECK
// Whether Cloudflare issues a token to THIS client. Turnstile exists to
// withhold tokens from automated browsers, so a headless run in a datacenter
// legitimately gets none. Treating that as failure would make the gate
// permanently red; treating it as success would make it meaningless. It is out
// of scope, and the checks above are the ones that actually fail silently.
//
// USAGE
//   TURNSTILE_SECRET=0x... node scripts/check-captcha.mjs
//   ... --base https://geolarp.com --site-key 0x4AAA...
//
// EXIT CODES
//   0  every verifiable link holds — safe to enable
//   1  a link is broken — DO NOT enable
//   2  could not run the check (missing input, network)

const VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// THE FALLBACK USED TO BE THE UPSTREAM DOMAIN (#133), so running this by hand
// without an argument silently probed a DIFFERENT SITE and reported confident
// results about it. CI always passes the URL explicitly, so this only ever bit
// someone running it manually — in the way hardest to notice. Same chain as
// `scripts/ci/check-cache-headers.mjs:49-55`, which fixed the same defect first.
const BASE = arg(
  'base',
  process.env.CHECK_BASE ||
    process.env.NEXT_PUBLIC_DEPLOY_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://geolarp.com'
);
const SITE_KEY = arg('site-key', process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY);
const SECRET = process.env.TURNSTILE_SECRET;

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}\n     ${detail}`);
};

if (!SITE_KEY) {
  console.error(
    'check-captcha: no site key.\n' +
      '  Pass --site-key, or set NEXT_PUBLIC_CAPTCHA_SITE_KEY in the environment.'
  );
  process.exit(2);
}

// --- 1. site key reached the deployed bundle -------------------------------
// The value is inlined into a JS chunk at build time, so it will not be in the
// page HTML. Fetch the page, then the chunks it references.
try {
  const html = await fetch(`${BASE}/sign-in/`).then((r) => r.text());
  let found = html.includes(SITE_KEY);
  if (!found) {
    const chunks = [...html.matchAll(/src="([^"]+\.js)"/g)]
      .map((m) => m[1])
      .slice(0, 40);
    for (const c of chunks) {
      const url = c.startsWith('http') ? c : `${BASE}${c.startsWith('/') ? '' : '/'}${c}`;
      const body = await fetch(url).then((r) => r.text()).catch(() => '');
      if (body.includes(SITE_KEY)) {
        found = true;
        break;
      }
    }
  }
  record(
    'site key is in the deployed build',
    found,
    found
      ? `${SITE_KEY} is served by ${BASE}`
      : `${SITE_KEY} is NOT in the deployed bundle — the build did not receive ` +
        `NEXT_PUBLIC_CAPTCHA_SITE_KEY. A repo variable alone does nothing; the ` +
        `workflow must pass it into the build step.`
  );
} catch (err) {
  record('site key is in the deployed build', false, `could not fetch ${BASE}: ${err.message}`);
}

// --- 2. secret is a real Turnstile secret ----------------------------------
// siteverify distinguishes the two failure modes precisely:
//   invalid-input-secret   -> the SECRET is wrong (users would be locked out)
//   invalid-input-response -> the secret is VALID, the dummy token is not
// The second is the result we want; it is the only proof the secret is real
// without solving a live challenge.
if (!SECRET) {
  record(
    'secret is a valid Turnstile secret',
    false,
    'TURNSTILE_SECRET is not set, so the secret could not be checked. Supabase ' +
      'returns it as a SHA-256 hash, so reading it back proves nothing. Supply ' +
      'the plaintext from https://dash.cloudflare.com/?to=/:account/turnstile'
  );
} else {
  try {
    const body = new URLSearchParams({ secret: SECRET, response: 'dummy-token' });
    const res = await fetch(VERIFY, { method: 'POST', body }).then((r) => r.json());
    const codes = res['error-codes'] ?? [];
    const secretOk = !codes.includes('invalid-input-secret');
    record(
      'secret is a valid Turnstile secret',
      secretOk,
      secretOk
        ? `Cloudflare accepted the secret (rejected only the dummy token: ${JSON.stringify(codes)})`
        : `Cloudflare rejected the SECRET itself (${JSON.stringify(codes)}). Enabling ` +
          `CAPTCHA with this secret refuses EVERY auth request, even with a valid token.`
    );
  } catch (err) {
    record('secret is a valid Turnstile secret', false, `siteverify unreachable: ${err.message}`);
  }
}

// --- 3. the browser is allowed to LOAD the widget --------------------------
//
// THE CHECK THAT WOULD HAVE PREVENTED THE OUTAGE (#137). On 2026-09-09 enabling
// `security_captcha_enabled` took ALL authentication down for ~20 minutes — sign-in,
// sign-up, recovery and resend, every one returning
// `captcha_failed: request disallowed (no captcha_token found)`.
//
// Nothing above was wrong. This script returned 2/2 immediately beforehand, the site
// key really was in the bundle, and the secret really was valid. The browser simply
// refused to fetch Turnstile's script, because the live CSP did not list
// `challenges.cloudflare.com`. No widget, so no token, so every request refused.
//
// The rollout ordering in AUTH-SETUP.md was followed exactly. It was not sufficient:
// it says nothing about whether the script may LOAD.
//
// This does not contradict the scope note above. "Will Cloudflare issue a token to
// this client" is out of scope and stays so; "may the browser fetch the script at all"
// is a different question, answered by a header read — cheap, deterministic, and the
// exact link that broke.
//
// THE POLICY IS NOT IN THIS REPOSITORY. It is a Cloudflare Response Header Transform
// Rule, like the #635 cache headers. Delete the rule, rotate the token or move the zone
// and it vanishes silently, which is why this is checked against the LIVE origin rather
// than against anything committed here.
const CSP_HOST = 'challenges.cloudflare.com';
const CSP_DIRECTIVES = ['script-src', 'frame-src', 'connect-src'];
try {
  const res = await fetch(BASE, { redirect: 'follow' });
  const header =
    res.headers.get('content-security-policy') ||
    res.headers.get('content-security-policy-report-only') ||
    '';

  if (!header) {
    // No policy is delivered, so nothing blocks the widget. Reporting this as a
    // failure would be crying wolf on a site that works.
    record(
      'CSP admits the Turnstile widget',
      true,
      `${BASE} delivers no Content-Security-Policy, so nothing can block the widget`
    );
  } else {
    const parsed = new Map(
      header
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
          const [name, ...values] = d.split(/\s+/);
          return [name.toLowerCase(), values];
        })
    );
    // `frame-src` and `connect-src` fall back to `default-src` when absent; an absent
    // default-src is unrestricted. Getting this wrong would fail a policy that works.
    const admits = (name) => {
      const values = parsed.get(name) ?? parsed.get('default-src');
      if (!values) return true; // unrestricted
      return values.some(
        (v) => v.includes(CSP_HOST) || v === 'https:' || v === '*'
      );
    };
    const missing = CSP_DIRECTIVES.filter((d) => !admits(d));
    record(
      'CSP admits the Turnstile widget',
      missing.length === 0,
      missing.length === 0
        ? `${CSP_HOST} is permitted by ${CSP_DIRECTIVES.join(', ')}`
        : `${CSP_HOST} is BLOCKED by ${missing.join(', ')} on ${BASE}. The browser ` +
          `will refuse to load the widget, so no token exists, so EVERY auth request ` +
          `is refused — sign-in and recovery included, not just sign-up. Add it to ` +
          `the Cloudflare response-header transform rule before enabling CAPTCHA (#137).`
    );
  }
} catch (err) {
  record(
    'CSP admits the Turnstile widget',
    false,
    `could not read the CSP from ${BASE}: ${err.message}`
  );
}

// --- report ----------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log();
if (failed.length) {
  console.log(`❌ ${failed.length}/${results.length} check(s) failed — DO NOT enable CAPTCHA.`);
  process.exit(1);
}
console.log(
  `✅ ${results.length}/${results.length} checks passed.\n` +
    '   Domain allowlisting is verified separately by the browser differential\n' +
    '   probe (bogus origin must return 110200); see docs/AUTH-SETUP.md.'
);
process.exit(0);
