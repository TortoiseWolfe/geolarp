const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'ci', 'check-retained-assets.mjs');

function retainedEntries(extra = []) {
  return [
    ...extra,
    ...Array.from(
      { length: 20 - extra.length },
      (_, index) => `/_next/static/chunks/asset-${index}.js`
    ),
  ];
}

/**
 * An `ASSET_AGES.txt` body whose oldest entry is `spanDays` old (#751).
 *
 * The probe reads this ledger to judge whether the retention WINDOW is wide enough,
 * which is a separate question from whether the files are reachable — and the one
 * nothing asked on the night production went unstyled an eighth time.
 */
function agesFor(entries, spanDays) {
  const now = Date.now();
  return entries
    .map((rel, i) => {
      const age =
        i === 0 ? spanDays : (spanDays * (entries.length - i)) / entries.length;
      const when = new Date(now - age * 86400000).toISOString();
      return `${i} ${when} ${rel.replace(/^\/+/, '')}`;
    })
    .join('\n');
}

function runProbe(baseUrl, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, baseUrl], {
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/**
 * The path, with any query string removed (#128).
 *
 * The probe cache-busts both ledger reads — they live under `/_next/static/`, which the edge
 * caches for a year, and reading a stale ledger made its verdict a function of edge cache
 * state. So the requests arrive as `...ASSET_MANIFEST.txt?cb=<nonce>` and an exact `===`
 * match on `request.url` silently stops matching. When that landed, all seven tests in this
 * file went red at once — which is the harness working: they were asserting real behaviour,
 * not passing vacuously.
 */
function pathOf(request) {
  return String(request.url || '').split('?')[0];
}

async function startServer(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('accepts a CDN-style 206 ranged GET when HEAD is unavailable', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer((request, response) => {
    if (pathOf(request) === '/_next/static/ASSET_MANIFEST.txt') {
      response.end(entries.join('\n'));
      return;
    }
    if (pathOf(request) === '/_next/static/ASSET_AGES.txt') {
      response.end(agesFor(entries, 20));
      return;
    }
    if (request.method === 'HEAD') {
      response.writeHead(405).end();
      return;
    }
    assert.equal(request.headers.range, 'bytes=0-0');
    response.writeHead(206, { 'content-range': 'bytes 0-0/1' }).end('x');
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl);

  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /MISSING   0/);
});

test('fails and names a missing retained stylesheet', async (t) => {
  const missing = '/_next/static/css/removed.css';
  const entries = retainedEntries([missing]);
  const server = await startServer((request, response) => {
    if (pathOf(request) === '/_next/static/ASSET_MANIFEST.txt') {
      response.end(entries.join('\n'));
      return;
    }
    if (pathOf(request) === '/_next/static/ASSET_AGES.txt') {
      response.end(agesFor(entries, 20));
      return;
    }
    if (pathOf(request) === missing) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end();
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /removed\.css/);
  assert.match(output, /STYLESHEETS/);
});

/**
 * THE WINDOW ASSERTION (#751).
 *
 * Every check above asks whether retained files are REACHABLE. On 2026-08-15 all 13
 * retained stylesheets were reachable and production was unstyled anyway, because
 * the window they represented had shrunk to ~3.5 days while the config claimed a
 * week. Reachability cannot see that; only these can.
 *
 * `RETENTION_RETIMED_AT` is backdated here because the floor is deliberately dormant
 * during the ledger's first fortnight — without the override these would be testing
 * the ramp, not the assertion.
 */
const PAST_RAMP = {
  RETENTION_RETIMED_AT: '2026-01-01T00:00:00Z',
  RETAIN_DAYS: '14',
};

/**
 * `missing: true` 404s one promised asset while serving the ledger normally, so a
 * test can hold the window narrow AND the chain broken at the same time. Without it
 * the two conditions can only be exercised apart, and nothing proves the reachability
 * assertion survives a change to the window one.
 */
const serveLedger =
  (entries, spanDays, { missing = false } = {}) =>
  (request, response) => {
    if (pathOf(request) === '/_next/static/ASSET_MANIFEST.txt') {
      response.end(entries.join('\n'));
      return;
    }
    if (pathOf(request) === '/_next/static/ASSET_AGES.txt') {
      response.end(agesFor(entries, spanDays));
      return;
    }
    if (missing && pathOf(request).endsWith('.css')) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end();
  };

test('REPORTS a narrow window without failing, and says why (#82)', async (t) => {
  // This test used to assert exit 1 here. It was changed deliberately, not relaxed
  // to make a red run green — the assertion it encoded could not distinguish a
  // broken retention chain from a slow deploy cadence.
  //
  // `firstSeen` is re-stamped to now for every file the new build reproduces, so the
  // oldest stamp belongs to the last file that STOPPED being published. The span is
  // therefore `D * floor(RETAIN_DAYS / D)` for a deploy every D days. Replaying this
  // repo's 37 real deploys through a perfect, never-stale ledger still measures 11.6
  // days and still failed. Nothing was wrong.
  //
  // What replaces it is in #82: assert the per-asset promise at DEPLOY time, where
  // the previous ledger is in hand and "was anything dropped while still inside its
  // window" is answerable. A post-deploy probe holding only the SURVIVING ledger
  // structurally cannot answer that, which is why this half is now a report.
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 2));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, PAST_RAMP);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 0, output);
  assert.match(output, /REPORTED, NOT ASSERTED/);
  assert.match(output, /2\.0 day\(s\)/);
  assert.match(output, /#82/);
});

test('can fail: a narrow window does NOT mask an unreachable asset', async (t) => {
  // The half that still hard-fails, exercised in the condition that now only warns.
  // Without this, downgrading the window check could have quietly taken the
  // reachability assertion with it, and every test above would still pass.
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 2, { missing: true }));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, PAST_RAMP);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /MISSING/);
});

test('passes when the window is at full width — the harness can reach success', async (t) => {
  // Without this the test above passes just as well against a probe that fails on
  // everything, which is the vacuous shape this repo keeps getting bitten by.
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 20));
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, PAST_RAMP);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 0, output);
  assert.match(output, /full width/);
});

test('stays quiet during the ramp, when a narrow window is correct', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer(serveLedger(entries, 2));
  t.after(() => server.close());

  // Same 2-day ledger as the failing case; only the retime date differs.
  const result = await runProbe(server.baseUrl, {
    RETENTION_RETIMED_AT: new Date().toISOString(),
    RETAIN_DAYS: '14',
  });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 0, output);
  assert.match(output, /still ramping/);
});

test('fails when the age ledger is missing entirely', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  const server = await startServer((request, response) => {
    if (pathOf(request) === '/_next/static/ASSET_MANIFEST.txt') {
      response.end(entries.join('\n'));
      return;
    }
    if (pathOf(request) === '/_next/static/ASSET_AGES.txt') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end();
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl, PAST_RAMP);
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 1, output);
  assert.match(output, /age ledger/i);
});

/**
 * BOTH LEDGER READS MUST BYPASS THE CACHE (#128).
 *
 * Both files sit under `/_next/static/`, which the edge caches for a YEAR by design. This
 * probe read them with a plain `fetch()`, so it asserted a cached PROMISE against the CURRENT
 * site and its verdict became a function of which edge node answered — production and a
 * developer's machine disagreed about the same site minutes apart.
 *
 * ASSERTED ON THE REQUEST, not on the source. A source scan for `cb=` would pass on a script
 * that built the URL and then never used it. The harness records what actually arrived.
 *
 * The `no-cache` header is asserted too, but the QUERY STRING is the mechanism: `cache:
 * 'no-store'` is honoured inconsistently by undici, and a header a proxy may ignore is not a
 * guarantee. If only the header were sent, this test should still fail.
 */
test('reads both ledgers with a cache buster, not from the edge cache (#128)', async (t) => {
  const entries = retainedEntries(['/_next/static/css/app.css']);
  /** @type {{path: string, url: string, cacheControl: string}[]} */
  const ledgerRequests = [];

  const server = await startServer((request, response) => {
    const p = pathOf(request);
    if (p.endsWith('ASSET_MANIFEST.txt') || p.endsWith('ASSET_AGES.txt')) {
      ledgerRequests.push({
        path: p,
        url: String(request.url || ''),
        cacheControl: String(request.headers['cache-control'] || ''),
      });
    }
    if (p === '/_next/static/ASSET_MANIFEST.txt') {
      response.end(entries.join('\n'));
      return;
    }
    if (p === '/_next/static/ASSET_AGES.txt') {
      response.end(agesFor(entries, 20));
      return;
    }
    response.end('x');
  });
  t.after(() => server.close());

  const result = await runProbe(server.baseUrl);
  assert.equal(result.code, 0, result.stdout + result.stderr);

  const manifest = ledgerRequests.find((r) =>
    r.path.endsWith('ASSET_MANIFEST.txt')
  );
  const ages = ledgerRequests.find((r) => r.path.endsWith('ASSET_AGES.txt'));

  // The probe must have asked for both — a run that fetched neither would satisfy
  // every `match` below vacuously.
  assert.ok(manifest, 'the probe never requested ASSET_MANIFEST.txt');
  assert.ok(ages, 'the probe never requested ASSET_AGES.txt');

  assert.match(
    manifest.url,
    /[?&]cb=/,
    'the manifest was read WITHOUT a cache buster, so a year-cached copy can be ' +
      'asserted against the live site (#128)'
  );
  assert.match(
    ages.url,
    /[?&]cb=/,
    'the age ledger was read without a cache buster'
  );
  assert.match(manifest.cacheControl, /no-cache/);
  assert.match(ages.cacheControl, /no-cache/);

  // ONE nonce per run, so the two ledgers describe the same moment. Two nonces would
  // let the manifest and the ages come from different edge states, which is the same
  // class of bug one level down.
  const nonceOf = (u) => (u.match(/[?&]cb=([^&]+)/) || [])[1];
  assert.equal(
    nonceOf(manifest.url),
    nonceOf(ages.url),
    'the two ledger reads used different nonces, so they can describe different moments'
  );
});
