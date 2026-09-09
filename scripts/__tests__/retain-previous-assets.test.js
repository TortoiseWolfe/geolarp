/**
 * Retention chaining across a deploy burst (#548).
 *
 * check-stale-html.mjs proves a browser renders correctly WHEN assets are
 * chained. It models the deploy itself, so it cannot prove the deploy actually
 * does the chaining — with the old ordering it would still have passed, because
 * the harness did the copying.
 *
 * This is the other half: drive the real `retain-previous-assets.mjs` against a
 * real HTTP server twice, and assert an asset introduced by generation A is
 * still published by generation C. That is exactly the property whose absence
 * rendered production with no CSS.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { createServer } = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

// MUST be async. The stub server lives in this process, so a synchronous
// execFileSync would block the event loop and the server could never answer —
// the script then reported "cannot read ... retention is a NO-OP", which is a
// true message about a harness bug rather than about the code under test.
const run = promisify(execFile);

const REPO = path.resolve(__dirname, '../..');
const WORK = path.join(__dirname, '.retain-work');

/** A generation: `n` CSS files with generation-specific names, plus a shared chunk. */
function makeGeneration(dir, tag) {
  const css = path.join(dir, '_next/static/css');
  fs.mkdirSync(css, { recursive: true });
  fs.writeFileSync(
    path.join(css, `${tag}.css`),
    `/* ${tag} */ body{color:red}`
  );
  fs.mkdirSync(path.join(dir, '_next/static/chunks'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '_next/static/chunks', `${tag}.js`),
    `console.log('${tag}')`
  );
  // The HTML crawl fallback needs something to read if there is no manifest.
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    `<link rel="stylesheet" href="/_next/static/css/${tag}.css"/>` +
      `<script src="/_next/static/chunks/${tag}.js"></script>`
  );
  return dir;
}

/**
 * Run the real script: retain from `liveDir` (served over HTTP) into `outDir`.
 *
 * `days` is the retention window (#751). It used to be a generation count; the
 * default is deliberately wide so the chaining tests below exercise chaining rather
 * than expiry, which is what they are about.
 */
async function retain(outDir, liveDir, days = 14, extraEnv = {}) {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = path.join(liveDir, rel === '/' ? 'index.html' : rel);
    // READ BEFORE writeHead. Writing the 200 first and letting readFileSync
    // throw sends headers, then the catch calls writeHead again —
    // ERR_HTTP_HEADERS_SENT kills the server on the FIRST 404, and every later
    // fetch hangs forever because nothing is listening. The script then printed
    // "cannot read <base> — retention is a NO-OP", a message that is true about
    // the harness and reads as a verdict on the code under test.
    let body;
    try {
      body = fs.readFileSync(file);
    } catch {
      res.writeHead(404);
      res.end('nope');
      return;
    }
    res.writeHead(200);
    res.end(body);
  });
  // Port 0 = whatever is free. A fixed port made every test after the first fail
  // with EADDRINUSE, because the close below deliberately does not wait.
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const { stdout } = await run(
      process.execPath,
      [
        path.join(REPO, 'scripts/retain-previous-assets.mjs'),
        outDir,
        `http://127.0.0.1:${port}`,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, RETAIN_DAYS: String(days), ...extraEnv },
      }
    );
    return stdout;
  } finally {
    // `server.close()` alone WAITS for keep-alive sockets to drain, and the
    // child's fetch leaves one open — awaiting it hung the whole suite with no
    // output. Drop the connections first, and do not await the close.
    server.closeAllConnections?.();
    server.close();
  }
}

const manifestOf = (dir) =>
  fs
    .readFileSync(path.join(dir, '_next/static/ASSET_MANIFEST.txt'), 'utf8')
    .split('\n')
    .filter(Boolean);

/** Path -> generation count. The generation number is now a diagnostic (#751). */
const agesOf = (dir) =>
  new Map(
    fs
      .readFileSync(path.join(dir, '_next/static/ASSET_AGES.txt'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
        return [m[3], Number(m[1])];
      })
  );

/** Path -> first-seen epoch ms. This is what retention actually decides on. */
const bornOf = (dir) =>
  new Map(
    fs
      .readFileSync(path.join(dir, '_next/static/ASSET_AGES.txt'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
        return [m[3], Date.parse(m[2])];
      })
  );

/**
 * Rewrite one entry's first-seen timestamp in a built directory's ledger.
 *
 * Retention is now measured in days, and a test cannot wait days. Backdating the
 * ledger is the only thing being simulated — the script reads it exactly as it would
 * read a genuinely old one.
 */
function backdate(dir, rel, days) {
  const p = path.join(dir, '_next/static/ASSET_AGES.txt');
  const when = new Date(Date.now() - days * 86400000).toISOString();
  const out = fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => {
      const m = l.match(/^(\d+)\s+(\S+T\S+Z)\s+(.+)$/);
      return m && m[3] === rel ? `${m[1]} ${when} ${m[3]}` : l;
    })
    .join('\n');
  assert.ok(
    out.includes(when),
    `backdate() failed to match ${rel} in the ledger`
  );
  fs.writeFileSync(p, out);
}

describe('retain-previous-assets: chaining across a burst (#548)', () => {
  before(() => {
    fs.rmSync(WORK, { recursive: true, force: true });
  });
  after(() => {
    fs.rmSync(WORK, { recursive: true, force: true });
  });

  it('publishes a manifest that includes what it retained, not just its own output', async () => {
    // This is the ordering fix stated as an assertion. With the manifest written
    // BEFORE the retain step it listed only generation B's own files, and B's
    // successor could never learn that A's CSS existed.
    const a = makeGeneration(path.join(WORK, 'a'), 'gen-a');
    const b = makeGeneration(path.join(WORK, 'b'), 'gen-b');

    await retain(b, a);

    const m = manifestOf(b);
    assert.ok(
      m.includes('_next/static/css/gen-a.css'),
      `B's manifest must list the asset it retained from A.\ngot:\n  ${m.join('\n  ')}`
    );
    assert.ok(
      m.includes('_next/static/css/gen-b.css'),
      "B's manifest must list its own CSS"
    );
  });

  it("carries generation A's asset through TWO deploys — the #548 case", async () => {
    // A -> B -> C. Under the old one-generation behaviour gen-a.css is absent
    // from C, and a visitor still holding A's HTML gets no CSS. That visitor is
    // the production screenshot.
    const a = makeGeneration(path.join(WORK, 'a2'), 'gen-a');
    const b = makeGeneration(path.join(WORK, 'b2'), 'gen-b');
    const c = makeGeneration(path.join(WORK, 'c2'), 'gen-c');

    await retain(b, a); // deploy 1
    await retain(c, b); // deploy 2 — reads B's manifest, which now names A's file

    assert.ok(
      fs.existsSync(path.join(c, '_next/static/css/gen-a.css')),
      "generation C must still publish A's stylesheet after two deploys (#548)"
    );
    assert.ok(manifestOf(c).includes('_next/static/css/gen-a.css'));
  });

  it('ages a retained asset by one generation per deploy', async () => {
    const a = makeGeneration(path.join(WORK, 'a3'), 'gen-a');
    const b = makeGeneration(path.join(WORK, 'b3'), 'gen-b');
    const c = makeGeneration(path.join(WORK, 'c3'), 'gen-c');

    await retain(b, a);
    assert.strictEqual(agesOf(b).get('_next/static/css/gen-a.css'), 1);
    assert.strictEqual(
      agesOf(b).get('_next/static/css/gen-b.css'),
      0,
      "B's own files are age 0"
    );

    await retain(c, b);
    assert.strictEqual(
      agesOf(c).get('_next/static/css/gen-a.css'),
      2,
      'A is two deploys old in C'
    );
    assert.strictEqual(agesOf(c).get('_next/static/css/gen-b.css'), 1);
  });

  it('ramps cleanly from a live build that has a manifest but no age table', async () => {
    // THE ACTUAL PRODUCTION TRANSITION, measured on prod before this shipped:
    //
    //   GET /_next/static/ASSET_MANIFEST.txt -> 200 (107 lines, written by the
    //                                          old pre-retention step)
    //   GET /_next/static/ASSET_AGES.txt     -> 404 (this change introduces it)
    //
    // The other tests start from a live build with NEITHER file, so none of them
    // covers the one state the next deploy is guaranteed to hit. A retained file
    // must simply start at age 1 here rather than throwing or being skipped.
    const a = makeGeneration(path.join(WORK, 'a5'), 'gen-a');
    const b = makeGeneration(path.join(WORK, 'b5'), 'gen-b');

    // An old-style manifest: this build's own files only, and no age table.
    fs.writeFileSync(
      path.join(a, '_next/static/ASSET_MANIFEST.txt'),
      ['_next/static/css/gen-a.css', '_next/static/chunks/gen-a.js'].join(
        '\n'
      ) + '\n'
    );
    assert.ok(!fs.existsSync(path.join(a, '_next/static/ASSET_AGES.txt')));

    await retain(b, a);

    assert.ok(
      fs.existsSync(path.join(b, '_next/static/css/gen-a.css')),
      'a live build with no age table must still have its assets retained'
    );
    assert.strictEqual(
      agesOf(b).get('_next/static/css/gen-a.css'),
      1,
      'with no age table to read from, a retained file starts at age 1'
    );
  });

  it('still publishes a manifest when the live site is unreachable', async () => {
    // THE REGRESSION THIS FIX NEARLY INTRODUCED.
    //
    // Writing the manifest used to be its own workflow step that always ran.
    // Folding it into this script — so it could describe what was retained —
    // put it behind four `process.exit(1)`s. Because the workflow step is
    // `continue-on-error`, a transient network problem would then ship a build
    // with NO manifest and still succeed, and the NEXT deploy would fall back to
    // crawling HTML: 33 of 106 static files. One bad moment, two degraded
    // deploys, and nothing red anywhere.
    //
    // The build's own output is knowable regardless of the network, so failing
    // to retain must never mean failing to publish.
    const b = makeGeneration(path.join(WORK, 'b6'), 'gen-b');

    // Port 1 is reserved and nothing listens there: the live site is unreachable.
    let exitCode = 0;
    try {
      await run(
        process.execPath,
        [
          path.join(REPO, 'scripts/retain-previous-assets.mjs'),
          b,
          'http://127.0.0.1:1',
        ],
        { encoding: 'utf8' }
      );
    } catch (err) {
      exitCode = err.code;
    }

    assert.notStrictEqual(
      exitCode,
      0,
      'an unreachable live site must exit non-zero'
    );
    assert.ok(
      fs.existsSync(path.join(b, '_next/static/ASSET_MANIFEST.txt')),
      'the manifest must be published even when retention could not run'
    );
    const m = manifestOf(b);
    assert.ok(
      m.includes('_next/static/css/gen-b.css'),
      `the manifest must still list this build's own files.\ngot:\n  ${m.join('\n  ')}`
    );
    assert.strictEqual(
      agesOf(b).get('_next/static/css/gen-b.css'),
      0,
      "this build's own files are age 0 even on the failure path"
    );
  });

  it('drops an asset once it is older than RETAIN_DAYS, so _next/static stays bounded', async () => {
    // The window is the only thing bounding chained retention. Without it every
    // deploy would accumulate forever, which is the obvious failure mode of the
    // fix and therefore worth a test of its own.
    const dirs = ['a4', 'b4', 'c4'].map((n, i) =>
      makeGeneration(path.join(WORK, n), `gen-${'abc'[i]}`)
    );
    await retain(dirs[1], dirs[0], 14);
    assert.ok(fs.existsSync(path.join(dirs[1], '_next/static/css/gen-a.css')));

    // Age A's stylesheet past the window in B's published ledger, exactly as real
    // elapsed time would. B's own file stays new.
    backdate(dirs[1], '_next/static/css/gen-a.css', 40);

    await retain(dirs[2], dirs[1], 14);
    assert.ok(
      !fs.existsSync(path.join(dirs[2], '_next/static/css/gen-a.css')),
      'an asset older than RETAIN_DAYS must not be carried forward'
    );
    assert.ok(
      fs.existsSync(path.join(dirs[2], '_next/static/css/gen-b.css')),
      'an asset still inside the window must survive'
    );
  });

  it('keeps an asset across MANY deploys while it is still inside the window', async () => {
    // The whole point of #751: deploy COUNT must not decide expiry. Under the old
    // generation cap this asset died on deploy 6; here it survives ten because it
    // is only a day old.
    const dirs = Array.from({ length: 11 }, (_, i) =>
      makeGeneration(path.join(WORK, `burst${i}`), `burst-${i}`)
    );
    for (let i = 1; i < dirs.length; i++)
      await retain(dirs[i], dirs[i - 1], 14);

    const last = dirs[dirs.length - 1];
    assert.ok(
      fs.existsSync(path.join(last, '_next/static/css/burst-0.css')),
      'a one-day-old asset must survive ten deploys — expiring it on a deploy ' +
        'count is exactly the #751 defect'
    );
    assert.strictEqual(
      agesOf(last).get('_next/static/css/burst-0.css'),
      10,
      'the generation counter should still be counting, as a diagnostic'
    );
  });

  it('carries the ORIGINAL first-seen date forward, never restamping it', async () => {
    // If a retained asset were redated on each deploy its age would reset every
    // time and the window would never expire anything — retention would grow
    // without bound while looking healthy.
    const dirs = ['a6', 'b6', 'c6'].map((n, i) =>
      makeGeneration(path.join(WORK, n), `gen-${'abc'[i]}`)
    );
    await retain(dirs[1], dirs[0], 14);
    backdate(dirs[1], '_next/static/css/gen-a.css', 10);
    const before = bornOf(dirs[1]).get('_next/static/css/gen-a.css');

    await retain(dirs[2], dirs[1], 14);
    const after = bornOf(dirs[2]).get('_next/static/css/gen-a.css');
    assert.strictEqual(
      after,
      before,
      'the first-seen timestamp must survive a deploy unchanged'
    );
  });

  it('reads the pre-#751 two-field ledger and stamps those entries now', async () => {
    // The live ledger on the deploy that ships this has no timestamps. Refusing to
    // parse it would reset retention to zero on the very deploy meant to fix it.
    const dirs = ['a7', 'b7'].map((n, i) =>
      makeGeneration(path.join(WORK, n), `gen-${'ab'[i]}`)
    );
    fs.writeFileSync(
      path.join(dirs[0], '_next/static/ASSET_AGES.txt'),
      '3 _next/static/css/gen-a.css\n'
    );

    const out = await retain(dirs[1], dirs[0], 14);
    assert.match(out, /without a timestamp/, 'the ramp should announce itself');
    assert.ok(
      fs.existsSync(path.join(dirs[1], '_next/static/css/gen-a.css')),
      'an undated legacy entry must be carried, not dropped'
    );
    const born = bornOf(dirs[1]).get('_next/static/css/gen-a.css');
    assert.ok(
      Date.now() - born < 5 * 60_000,
      'a legacy entry should be stamped now, giving it a full window'
    );
  });
});

/**
 * THE WINDOW IS A DURATION, AND MUST BE EXPRESSED AS ONE (#650, #751).
 *
 * This was `RETAIN_GENERATIONS` and it was mis-sized twice, both times by stating
 * the window in deploys while the risk is in days:
 *
 *   5  — sized against "deploys per 10 minutes", the HTML cache-control window.
 *        #650 identified that as the wrong quantity when production went unstyled a
 *        sixth time on 2026-08-09.
 *   30 — its replacement, justified as "a normal working week even at an unusually
 *        high merge rate". 40 deploys landed in the next 6 days, 19 in one day, so
 *        it was really ~3.5 days. Production went unstyled an eighth time.
 *
 * The unit is the fix. A day is a day no matter how often anyone merges, so these
 * assertions pin the UNIT as much as the number — a value in generations cannot
 * satisfy them at all.
 */
describe('RETAIN_DAYS is sized for a returning visitor', () => {
  const deployYml = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'),
    'utf8'
  );

  it('is set in deploy.yml at all', () => {
    assert.match(
      deployYml,
      /RETAIN_DAYS:\s*'?\d+'?/,
      'deploy.yml no longer sets RETAIN_DAYS — retention would fall back to the ' +
        'script default and nothing would say so'
    );
  });

  it('covers a fortnight, so a holiday-length absence is inside the window', () => {
    const m = deployYml.match(/RETAIN_DAYS:\s*'?(\d+)'?/);
    const n = Number(m[1]);
    assert.ok(
      n >= 14,
      `RETAIN_DAYS is ${n}. Below 14 a visitor returning from a week or two away ` +
        `loses their stylesheets — that is #635, reported from production eight ` +
        `times. Raise it back, or make the case in the issue first.`
    );
  });

  it('has not reverted to counting deploys', () => {
    assert.ok(
      !/RETAIN_GENERATIONS:/.test(deployYml),
      'deploy.yml sets RETAIN_GENERATIONS again. That unit is the #751 defect: it ' +
        'converts to a duration only via a merge rate nobody measures. Express the ' +
        'window in days.'
    );
  });
});

/**
 * THE PER-ASSET PROMISE, ASSERTED AT DEPLOY TIME (#82).
 *
 * The promise is per-file: everything the previous deploy published stays served for
 * `RETAIN_DAYS` after it stops being published. Nothing checked it, and the post-deploy
 * probe structurally cannot — a file lost during retention never reaches the new
 * manifest, and that manifest is the list the probe walks, so losing one makes the
 * probe's input SMALLER and it reports green by construction.
 *
 * These drive the real script over a real socket, the same as the suite above.
 */
describe('per-asset retention assertion (#82)', () => {
  const GHOST = '_next/static/css/ghost.css';

  /** A live dir whose LEDGER promises `GHOST`, dated now, so it is inside the window. */
  function liveWithPromise(dir, { serveGhost }) {
    makeGeneration(dir, 'prev');
    const staticDir = path.join(dir, '_next/static');
    fs.mkdirSync(staticDir, { recursive: true });
    const promised = [GHOST, '_next/static/css/prev.css'];
    fs.writeFileSync(
      path.join(staticDir, 'ASSET_MANIFEST.txt'),
      promised.join('\n') + '\n'
    );
    fs.writeFileSync(
      path.join(staticDir, 'ASSET_AGES.txt'),
      promised.map((rel) => `1 ${new Date().toISOString()} ${rel}`).join('\n') +
        '\n'
    );
    if (serveGhost) {
      fs.writeFileSync(path.join(dir, GHOST), '/* ghost */ body{color:blue}');
    }
    return dir;
  }

  /** Like `retain()`, but returns the failure instead of throwing on it. */
  async function retainAllowingFailure(outDir, liveDir) {
    try {
      return { code: 0, stdout: await retain(outDir, liveDir) };
    } catch (err) {
      return {
        code: err.code ?? 1,
        stdout: String(err.stdout ?? ''),
        stderr: String(err.stderr ?? ''),
      };
    }
  }

  /**
   * THE CASE THE WHOLE TICKET IS ABOUT. A promised, in-window asset that 404s during
   * retention used to be counted into `failed` and forgotten — no bytes, no ledger
   * entry, and the next deploy never sees it again. One transient blip evicts it
   * permanently.
   */
  it('fails, and NAMES the file, when a promised in-window asset cannot be fetched', async () => {
    const live = liveWithPromise(path.join(WORK, 'p82-lost-live'), {
      serveGhost: false,
    });
    const out = makeGeneration(path.join(WORK, 'p82-lost-out'), 'next');

    const result = await retainAllowingFailure(out, live);
    const all = result.stdout + (result.stderr ?? '');

    assert.equal(result.code, 1, `expected a non-zero exit.\n${all}`);
    assert.match(all, /::error::/);
    assert.ok(
      all.includes(GHOST),
      `the failure must NAME the lost asset — a count nobody can act on is barely ` +
        `better than silence.\n${all}`
    );
    assert.match(all, /unreachable on the live host/);
  });

  /**
   * THE LEDGER MUST STILL BE PUBLISHED. Failing before `publishManifest()` would leave
   * the next deploy nothing to carry forward — strictly worse than the defect being
   * reported. The assertion is the exit code, never a reason to skip the write.
   */
  it('still publishes the ledger on the failing path', async () => {
    const live = liveWithPromise(path.join(WORK, 'p82-ledger-live'), {
      serveGhost: false,
    });
    const out = makeGeneration(path.join(WORK, 'p82-ledger-out'), 'next');

    const result = await retainAllowingFailure(out, live);
    assert.equal(result.code, 1);

    const manifest = path.join(out, '_next/static/ASSET_MANIFEST.txt');
    assert.ok(
      fs.existsSync(manifest),
      'the ledger was not published on the failing path, so the NEXT deploy would ' +
        'carry nothing forward — worse than the failure being reported'
    );
    assert.ok(fs.readFileSync(manifest, 'utf8').trim().length > 0);
  });

  /**
   * THE POSITIVE CONTROL. Without it, an assertion that failed unconditionally would
   * satisfy both cases above and this file would certify nothing.
   */
  it('passes when the promised asset IS carried forward', async () => {
    const live = liveWithPromise(path.join(WORK, 'p82-ok-live'), {
      serveGhost: true,
    });
    const out = makeGeneration(path.join(WORK, 'p82-ok-out'), 'next');

    const result = await retainAllowingFailure(out, live);
    assert.equal(result.code, 0, result.stdout + (result.stderr ?? ''));
    assert.match(result.stdout, /per-asset retention holds/);
    assert.ok(
      fs.existsSync(path.join(out, GHOST)),
      'the asset was not retained'
    );
  });

  /**
   * THE GATE MUST NOT FIRE ON A CRAWLED LIST. With no previous manifest the file list
   * comes from crawling live HTML — measured in the script at 33 of 106 static files.
   * Asserting over that set asserts a far weaker promise while printing the same
   * confident line, which is the exact shape of gate this repo keeps unpicking.
   */
  it('does not assert when there is no previous manifest to assert against', async () => {
    // No ledger written: makeGeneration alone leaves the script to crawl HTML.
    const live = makeGeneration(path.join(WORK, 'p82-crawl-live'), 'prev');
    const out = makeGeneration(path.join(WORK, 'p82-crawl-out'), 'next');

    const result = await retainAllowingFailure(out, live);
    const all = result.stdout + (result.stderr ?? '');
    assert.equal(result.code, 0, all);
    assert.match(all, /per-asset retention not asserted/);
  });
});

/**
 * THE ASSERTION NEEDS SOMEWHERE TO LAND (#82).
 *
 * `retain-previous-assets.mjs` now exits non-zero when the per-asset promise breaks.
 * The step that runs it is `continue-on-error: true`, and until #82 NOTHING read its
 * outcome — so the assertion would have exited into a green job. "A warning inside a
 * green check" is the exact thing the comment above that step says continue-on-error
 * was chosen to avoid, and it would have made the whole assertion decorative.
 *
 * THE SHAPE MATTERS AS MUCH AS ITS PRESENCE. The report lives in a SEPARATE job,
 * because `deploy` needs `build-and-deploy` — failing the build job would block
 * shipping over a transient network problem, which is the outcome continue-on-error
 * exists to prevent. Both halves are asserted: that it reports, and that it cannot
 * block.
 *
 * Parsed as text, following e2e-local-triggers.test.js, with a guard proving the
 * parser found the file before anything below is trusted.
 */
describe('the retention assertion is wired to be visible (#82)', () => {
  const wf = fs.readFileSync(
    path.join(REPO, '.github/workflows/deploy.yml'),
    'utf8'
  );

  it('found the workflow and its jobs — a silent miss is not a pass', () => {
    assert.ok(wf.length > 2000, 'deploy.yml did not read');
    assert.match(wf, /^ {2}build-and-deploy:$/m);
    assert.match(wf, /^ {2}deploy:$/m);
  });

  it('gives the retain step an id, or nothing can reference its outcome', () => {
    assert.match(
      wf,
      /- name: Retain previous builds' assets[^\n]*\n\s+id: retain\n/,
      'the retain step lost `id: retain`, so `steps.retain.outcome` is empty and the ' +
        'assertion exits into a green job'
    );
  });

  it('surfaces the OUTCOME, not the conclusion', () => {
    // `continue-on-error: true` rewrites `conclusion` to success. Reading conclusion
    // would make this report green forever — a check that cannot fail.
    assert.match(
      wf,
      /retention:\s*\$\{\{\s*steps\.retain\.outcome\s*\}\}/,
      'the job output must read steps.retain.OUTCOME; conclusion is rewritten to ' +
        'success by continue-on-error and would never report a failure'
    );
  });

  it('reports through a job that runs even when the build fails', () => {
    assert.match(
      wf,
      /^ {2}retention-result:$/m,
      'the retention-result job is gone'
    );
    const job = wf.slice(wf.indexOf('  retention-result:'));
    assert.match(job, /needs: build-and-deploy/);
    assert.match(
      job,
      /if: always\(\)/,
      'without if: always() the report cannot run after a failed build, and a check ' +
        'that never reports is pending forever rather than skipped'
    );
    assert.match(job, /needs\.build-and-deploy\.outputs\.retention/);
  });

  /**
   * THE HALF THAT PROTECTS SHIPPING. If `deploy` ever came to depend on the report,
   * a transient fetch failure during retention would stop the site deploying — worse
   * than the defect the report exists to surface.
   */
  it('cannot block the deploy', () => {
    const deployJob = wf.slice(wf.indexOf('\n  deploy:'));
    const needs = (deployJob.match(/needs:[^\n]*/) || [''])[0];
    assert.ok(
      needs.includes('build-and-deploy'),
      `unexpected deploy needs: ${needs}`
    );
    assert.ok(
      !needs.includes('retention-result'),
      'the deploy job now depends on the retention report, so a network blip during ' +
        'retention would block shipping (#82)'
    );
  });

  /**
   * The stale claim this ticket removed. deploy.yml told readers the post-deploy probe
   * FAILS on a narrow window; that stopped being true at d2b2aa25 and stood for weeks.
   */
  it('no longer claims the post-deploy probe asserts the window', () => {
    assert.ok(
      !/in smoke\.yml FAILS if the live window is/.test(wf),
      'deploy.yml has gone back to claiming check-retained-assets.mjs gates on the ' +
        'window. It reports the figure and does not assert it (#82).'
    );
  });
});

/**
 * RETAIN_MAX_FILES IS A COUNT CAP SITTING ON A QUANTITY THAT MUST BE A DURATION (#82).
 *
 * It sorts newest-first and truncates, so what it drops is BY DEFINITION files still
 * inside their window — precisely "vanished while still inside its window". It is
 * `RETAIN_GENERATIONS` wearing a different name, and the #751 guard cannot see it: that
 * test only greps `deploy.yml` for the literal `RETAIN_GENERATIONS`.
 *
 * Until now the truncation branch had NEVER EXECUTED UNDER TEST — repo-wide it appears
 * only in the script that defines it plus one prose mention in deploy.yml, with no
 * workflow env and no coverage. The per-asset assertion added in #130 now depends on
 * it: overflow feeds `lostToBackstop`, which fails the run. An untested branch that a
 * gate depends on is the gate's blind spot.
 */
describe('the file-count backstop (#82)', () => {
  /** A live ledger promising `count` in-window files, all actually served. */
  function liveWithMany(dir, count) {
    makeGeneration(dir, 'prev');
    const staticDir = path.join(dir, '_next/static');
    fs.mkdirSync(path.join(staticDir, 'chunks'), { recursive: true });
    const promised = [];
    for (let i = 0; i < count; i++) {
      const rel = `_next/static/chunks/many-${i}.js`;
      fs.writeFileSync(path.join(dir, rel), `console.log(${i})`);
      promised.push(rel);
    }
    fs.writeFileSync(
      path.join(staticDir, 'ASSET_MANIFEST.txt'),
      promised.join('\n') + '\n'
    );
    fs.writeFileSync(
      path.join(staticDir, 'ASSET_AGES.txt'),
      promised.map((rel) => `1 ${new Date().toISOString()} ${rel}`).join('\n') +
        '\n'
    );
    return dir;
  }

  async function runWith(outDir, liveDir, env) {
    try {
      return { code: 0, stdout: await retain(outDir, liveDir, 14, env) };
    } catch (err) {
      return {
        code: err.code ?? 1,
        stdout: String(err.stdout ?? ''),
        stderr: String(err.stderr ?? ''),
      };
    }
  }

  /**
   * THE BRANCH THAT HAD NEVER RUN. With the cap below the promise count, the backstop
   * drops in-window files — and since #130 that is a failure rather than a warning
   * nobody reads.
   */
  it('drops in-window assets when it engages, and that now FAILS and names them', async () => {
    const live = liveWithMany(path.join(WORK, 'p82-cap-live'), 6);
    const out = makeGeneration(path.join(WORK, 'p82-cap-out'), 'next');

    const result = await runWith(out, live, { RETAIN_MAX_FILES: '2' });
    const all = result.stdout + (result.stderr ?? '');

    assert.match(all, /backstop/, `the backstop never engaged.\n${all}`);
    assert.equal(
      result.code,
      1,
      `overflow must fail: what it drops is by definition still inside its window, ` +
        `which is the whole subject of #82.\n${all}`
    );
    assert.match(all, /dropped by the 2-file backstop/);
    assert.match(
      all,
      /_next\/static\/chunks\/many-\d+\.js/,
      'the failure must NAME a dropped file'
    );
  });

  /**
   * THE CONTROL. Same fixture, cap above the promise count — so a test that failed
   * because the harness is broken, rather than because the backstop engaged, is
   * distinguishable from a real result.
   */
  it('stays dormant and passes when the cap is above the promise count', async () => {
    const live = liveWithMany(path.join(WORK, 'p82-nocap-live'), 6);
    const out = makeGeneration(path.join(WORK, 'p82-nocap-out'), 'next');

    const result = await runWith(out, live, { RETAIN_MAX_FILES: '800' });
    assert.equal(result.code, 0, result.stdout + (result.stderr ?? ''));
    assert.ok(
      !/backstop/.test(result.stdout),
      'the backstop engaged at a cap far above the promise count'
    );
    assert.match(result.stdout, /per-asset retention holds/);
  });

  /**
   * THE RATCHET GUARD, and the reason this is filed under #82 rather than as a tidy-up.
   *
   * `RETAIN_GENERATIONS` went 5 -> 30 while real coverage silently fell to ~3.5 days.
   * `RETAIN_MAX_FILES` is the same shape and is currently invisible to the #751 guard,
   * which greps only `deploy.yml` and only for the literal `RETAIN_GENERATIONS`. Setting
   * it in a workflow converts a runaway backstop into a coverage cap — the identical
   * mistake, in a variable nothing watches.
   *
   * It is a RUNAWAY GUARD, so no workflow should set it at all. If one ever legitimately
   * needs to, this test is where the justification goes.
   */
  it('is not set by any workflow — a runaway guard is not a tuning knob', () => {
    const dir = path.join(REPO, '.github/workflows');
    const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
    assert.ok(
      files.length > 5,
      'no workflows found; this assertion would be vacuous'
    );

    const offenders = files.filter((f) =>
      /^\s*RETAIN_MAX_FILES\s*:/m.test(
        fs.readFileSync(path.join(dir, f), 'utf8')
      )
    );
    assert.deepEqual(
      offenders,
      [],
      'a workflow sets RETAIN_MAX_FILES, turning the runaway backstop into a coverage ' +
        'cap. That is exactly how RETAIN_GENERATIONS cut coverage to ~3.5 days while ' +
        'reading as a safety measure (#751, #82).'
    );
  });
});

/**
 * THE TWO LEDGERS MUST DESCRIBE THE SAME DEPLOY (#82).
 *
 * `publishManifest()` writes `ASSET_MANIFEST.txt` and `ASSET_AGES.txt` from ONE array
 * in one pass, so they cannot legitimately disagree. A live disagreement means one was
 * served stale or truncated — the class #84 and #128 closed on the two readers, caught
 * here from the other side, as data rather than as a cache header.
 *
 * This is #82's "ledger chain continuity" ask, delivered without adding a field to a
 * format four readers parse and without a skipped-generation tolerance to tune — a
 * re-run, a rollback or a publish that failed after the build all move the chain
 * backwards through no fault of retention, and a naive fingerprint check fails those.
 */
describe('ledger cross-check (#82)', () => {
  async function runWith(outDir, liveDir) {
    try {
      return { code: 0, stdout: await retain(outDir, liveDir) };
    } catch (err) {
      return {
        code: err.code ?? 1,
        stdout: String(err.stdout ?? ''),
        stderr: String(err.stderr ?? ''),
      };
    }
  }

  /** A live dir whose manifest names `extra` but whose age table omits it. */
  function desyncedLive(dir, { omitFromAges }) {
    makeGeneration(dir, 'prev');
    const staticDir = path.join(dir, '_next/static');
    fs.mkdirSync(path.join(staticDir, 'chunks'), { recursive: true });
    const both = '_next/static/chunks/described.js';
    const orphan = '_next/static/chunks/orphan.js';
    fs.writeFileSync(path.join(dir, both), 'console.log(1)');
    fs.writeFileSync(path.join(dir, orphan), 'console.log(2)');

    fs.writeFileSync(
      path.join(staticDir, 'ASSET_MANIFEST.txt'),
      [both, orphan].join('\n') + '\n'
    );
    const described = omitFromAges ? [both] : [both, orphan];
    fs.writeFileSync(
      path.join(staticDir, 'ASSET_AGES.txt'),
      described
        .map((rel) => `1 ${new Date().toISOString()} ${rel}`)
        .join('\n') + '\n'
    );
    return dir;
  }

  /**
   * WHAT THE DESYNC ACTUALLY COSTS, and why it is worth failing over. An entry the age
   * table does not describe takes `?? NOW`, so it is dated today — and then re-stamped
   * today in the ledger this run publishes. It never ages out, every deploy resets it,
   * and the manifest grows until RETAIN_MAX_FILES engages and the per-asset assertion
   * fails far from the cause, looking like a different bug.
   */
  it('fails and names a manifest path the age table does not describe', async () => {
    const live = desyncedLive(path.join(WORK, 'p82-desync-live'), {
      omitFromAges: true,
    });
    const out = makeGeneration(path.join(WORK, 'p82-desync-out'), 'next');

    const result = await runWith(out, live);
    const all = result.stdout + (result.stderr ?? '');

    assert.equal(result.code, 1, `expected a non-zero exit.\n${all}`);
    assert.match(all, /the live ledgers disagree/);
    assert.match(
      all,
      /orphan\.js/,
      'the failure must NAME the undescribed path'
    );
    // The other failure mode must NOT be claimed: nothing was lost here, and a
    // message that misdescribes the failure sends the next reader to the wrong place.
    assert.ok(
      !/asset\(s\) the previous deploy promised to keep serving/.test(all),
      'reported a lost-asset failure when the failure was a ledger desync'
    );
  });

  /**
   * THE WORK MUST STILL HAPPEN. The check reports at the END, after retention and after
   * the ledger is published — exiting at the point of detection would skip retention
   * entirely and publish a ledger holding only this build, stranding every visitor on
   * older HTML immediately. That is far worse than the inconsistency being reported.
   */
  it('still retains and still publishes the ledger on the desync path', async () => {
    const live = desyncedLive(path.join(WORK, 'p82-desync2-live'), {
      omitFromAges: true,
    });
    const out = makeGeneration(path.join(WORK, 'p82-desync2-out'), 'next');

    const result = await runWith(out, live);
    assert.equal(result.code, 1);

    const manifest = path.join(out, '_next/static/ASSET_MANIFEST.txt');
    assert.ok(fs.existsSync(manifest), 'the ledger was not published');
    assert.ok(
      fs.existsSync(path.join(out, '_next/static/chunks/orphan.js')),
      'retention was skipped, so visitors on older HTML lost their assets — the ' +
        'report must not cost more than the defect it reports'
    );
  });

  /** The control: consistent ledgers must not trip it. */
  it('passes when both ledgers describe the same set', async () => {
    const live = desyncedLive(path.join(WORK, 'p82-sync-live'), {
      omitFromAges: false,
    });
    const out = makeGeneration(path.join(WORK, 'p82-sync-out'), 'next');

    const result = await runWith(out, live);
    assert.equal(result.code, 0, result.stdout + (result.stderr ?? ''));
    assert.ok(!/ledgers disagree/.test(result.stdout));
  });

  /**
   * THE RAMP MUST NOT TRIP IT. With no age table at all the check is skipped — that is
   * the documented one-deploy ramp, not a desync. Without this, introducing the check
   * would red the very first deploy that runs it.
   */
  it('stays silent when there is no age table at all (the ramp)', async () => {
    const live = path.join(WORK, 'p82-ramp-live');
    makeGeneration(live, 'prev');
    const staticDir = path.join(live, '_next/static');
    fs.mkdirSync(staticDir, { recursive: true });
    fs.writeFileSync(
      path.join(staticDir, 'ASSET_MANIFEST.txt'),
      '_next/static/css/prev.css\n'
    );
    const out = makeGeneration(path.join(WORK, 'p82-ramp-out'), 'next');

    const result = await runWith(out, live);
    const all = result.stdout + (result.stderr ?? '');
    assert.equal(result.code, 0, all);
    assert.ok(!/ledgers disagree/.test(all));
  });
});
