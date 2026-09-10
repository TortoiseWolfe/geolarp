/**
 * The captcha preflight must check that the browser may LOAD the widget (#137).
 *
 * On 2026-09-09 enabling `security_captcha_enabled` took ALL authentication down for about
 * twenty minutes. Sign-in, sign-up, recovery and resend every one returned
 * `captcha_failed — request disallowed (no captcha_token found)`, locking out existing
 * accounts, not just new registrations: the flag is global to auth.
 *
 * NOTHING WAS WRONG WITH THE PREFLIGHT'S EXISTING CHECKS. `check-captcha.mjs` returned 2/2
 * immediately beforehand. The site key really was in the bundle and the secret really was
 * valid. The browser simply refused to fetch Turnstile's script, because the live CSP did not
 * list `challenges.cloudflare.com`. No widget, so no token, so every request refused. The
 * documented rollout ordering was followed exactly and was not sufficient — it says nothing
 * about whether the script may load.
 *
 * These drive the real script over a real socket against synthetic CSP headers, because the
 * assertion that matters is the one that FAILS, and production is (now) correctly configured.
 *
 * THE FALSE-FAILURE CASES ARE HALF THE POINT. A CSP check that does not implement CSP
 * semantics would red a site that works: `frame-src` legitimately falls back to `default-src`,
 * an absent `default-src` is unrestricted, and a `https:` scheme-source admits every https
 * host. Each has a test, because a preflight that cries wolf gets bypassed — which is how the
 * outage would recur.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'check-captcha.mjs');
const SITE_KEY = '0xTESTSITEKEY';
const HOST = 'challenges.cloudflare.com';

/** Serve one page carrying `csp` (omitted entirely when null), with the site key in it. */
async function startSite(csp) {
  const server = createServer((_req, res) => {
    const headers = { 'content-type': 'text/html' };
    if (csp) headers['content-security-policy'] = csp;
    res.writeHead(200, headers);
    // The site key must be present or check 1 fails for an unrelated reason and the
    // output is harder to read.
    res.end(`<html><body><script>const k="${SITE_KEY}"</script></body></html>`);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

function runPreflight(base) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [SCRIPT, '--site-key', SITE_KEY, '--base', base],
      { encoding: 'utf8', env: { ...process.env, TURNSTILE_SECRET: '' } }
    );
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (code) => resolve({ code, out }));
  });
}

/**
 * The CSP check's own two lines — its ✅/❌ heading AND the indented detail beneath it.
 *
 * BOTH, deliberately. `record()` prints the verdict and the explanation on separate lines, so
 * a helper returning only the heading can never see a directive name. The first version of
 * this file did exactly that, which made one assertion fail for the wrong reason and its
 * `doesNotMatch` sibling pass vacuously — a matcher scoped to a string that could not contain
 * what it was looking for.
 */
function cspLine(out) {
  const lines = out.split('\n');
  const at = lines.findIndex((l) =>
    l.includes('CSP admits the Turnstile widget')
  );
  assert.ok(at >= 0, `no CSP check ran at all:\n${out}`);
  return lines.slice(at, at + 2).join('\n');
}

test('FAILS when the CSP omits the widget host — the outage condition', async (t) => {
  const site = await startSite(
    "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-src 'self'; connect-src 'self'"
  );
  t.after(() => site.close());

  const { out } = await runPreflight(site.base);
  assert.match(cspLine(out), /❌/, `expected the CSP check to fail:\n${out}`);
  // It must name every blocked directive, or the reader has to guess which to fix.
  assert.match(out, /script-src/);
  assert.match(out, /frame-src/);
  assert.match(out, /connect-src/);
  // And say what it costs, because "sign-up only" is the wrong mental model.
  assert.match(out, /sign-in and recovery included/);
});

test('PASSES when all three directives admit the host', async (t) => {
  const site = await startSite(
    `default-src 'self'; script-src 'self' https://${HOST}; ` +
      `frame-src https://${HOST}; connect-src 'self' https://${HOST}`
  );
  t.after(() => site.close());

  const { out } = await runPreflight(site.base);
  assert.match(cspLine(out), /✅/, `expected the CSP check to pass:\n${out}`);
});

test('FAILS when only some directives admit it — script-src alone is not enough', async (t) => {
  // The real fix needed three directives. A check that stopped at script-src would have
  // gone green on a page where the iframe and the token POST were still blocked.
  const site = await startSite(
    `default-src 'self'; script-src 'self' https://${HOST}; frame-src 'self'; connect-src 'self'`
  );
  t.after(() => site.close());

  const { out } = await runPreflight(site.base);
  assert.match(
    cspLine(out),
    /❌/,
    `expected a partial policy to fail:\n${out}`
  );
  assert.doesNotMatch(
    cspLine(out),
    /script-src/,
    'script-src admits it and must not be named'
  );
  assert.match(cspLine(out), /frame-src/);
});

test('does not cry wolf when no CSP is delivered at all', async (t) => {
  // Nothing blocks the widget, so failing here would be a false alarm on a working site —
  // and a preflight that cries wolf gets bypassed, which is how the outage recurs.
  const site = await startSite(null);
  t.after(() => site.close());

  const { out } = await runPreflight(site.base);
  assert.match(cspLine(out), /✅/, `a site with no CSP must pass:\n${out}`);
  assert.match(out, /delivers no Content-Security-Policy/);
});

test('honours the default-src fallback rather than demanding every directive', async (t) => {
  // `frame-src` and `connect-src` fall back to `default-src` when absent. A checker that
  // ignored that would red a policy that genuinely permits the widget.
  const site = await startSite(
    `default-src https://${HOST}; script-src 'self' https://${HOST}`
  );
  t.after(() => site.close());

  const { out } = await runPreflight(site.base);
  assert.match(
    cspLine(out),
    /✅/,
    `default-src fallback must be honoured:\n${out}`
  );
});

test('accepts a https: scheme-source, which admits every https host', async (t) => {
  // geolarp.com's real connect-src carries `https:`. Treating that as blocking would fail
  // the live site.
  const site = await startSite(
    `script-src 'self' https://${HOST}; frame-src https://${HOST}; connect-src 'self' https:`
  );
  t.after(() => site.close());

  const { out } = await runPreflight(site.base);
  assert.match(
    cspLine(out),
    /✅/,
    `a https: scheme-source must be accepted:\n${out}`
  );
});
