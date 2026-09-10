/**
 * No markdown may build a github.com URL from the DISPLAY NAME (#12).
 *
 * `rebrand.sh` substituted the project name blindly, and it rewrote the PATH SEGMENT of full
 * GitHub URLs rather than only prose. Forty links that had pointed at
 * `TortoiseWolfe/ScriptHammer/issues/N` — where the content still exists and is still relevant —
 * became `TortoiseWolfe/geoLARP/issues/N`.
 *
 * THE TICKET CALLED THESE "42 links that 404", AND THAT IS NO LONGER THE FAILURE MODE. It is
 * now the safer half of one. Measured 2026-09-10 across the 24 distinct numbers referenced:
 *
 *     13 resolve (200 or 302)      11 still 404
 *
 * `…/geoLARP/issues/51` redirects to `…/geolarp/pull/51` — a real, unrelated pull request in
 * THIS repository. As geoLARP accumulates issues and PRs the rest will follow. A 404 announces
 * itself; a link that silently lands on unrelated content does not, and the reader has no way to
 * know they were sent somewhere the author never meant.
 *
 * WHY THIS TEST IS KEYED ON CASE RATHER THAN ON THE NUMBERS. The slug is lowercase `geolarp`;
 * `geoLARP` is the display name. So ANY github.com URL carrying the display-cased form is wrong
 * by construction, whoever wrote it and whatever it points at — no network call needed to know
 * it. That is the same display-name-versus-slug defect as #97 (the PWA install prompt) and #115
 * (the smoke test asking GitHub Pages for the wrong URL), which is twice this repo has been bitten
 * by exactly this distinction.
 *
 * Referencing this project's own issues by full URL is fine — with the real slug.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

/** Tracked markdown only. Untracked scratch files are nobody's link rot. */
function trackedMarkdown() {
  const out = execFileSync('git', ['ls-files', '*.md'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return out.split('\n').filter(Boolean);
}

/** The real slug, from the remote — never assumed. */
function repoSlug() {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  assert.ok(m, `could not parse a GitHub slug from the origin remote: ${url}`);
  return { owner: m[1], repo: m[2] };
}

const FILES = trackedMarkdown();
const { owner, repo } = repoSlug();

describe('no markdown URL uses the display-cased repo name (#12)', () => {
  it('found tracked markdown and a real slug — a silent zero is not a pass', () => {
    assert.ok(
      FILES.length > 50,
      `only ${FILES.length} tracked .md files found; the walker is broken and every ` +
        'assertion below would pass vacuously'
    );
    assert.match(
      repo,
      /^[a-z0-9._-]+$/,
      `slug "${repo}" is not lowercase; re-check this test`
    );
  });

  it('every github.com URL for this repo uses the real slug', () => {
    // Any casing of the repo name that is NOT the slug itself.
    const re = new RegExp(
      `github\\.com/${owner}/(?!${repo}\\b)([A-Za-z0-9._-]+)`,
      'g'
    );
    const offenders = [];
    for (const rel of FILES) {
      const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      for (const m of body.matchAll(re)) {
        // Only flag names that differ from the slug purely by case — a link to a
        // genuinely different repository of the same owner is legitimate.
        if (m[1].toLowerCase() === repo.toLowerCase() && m[1] !== repo) {
          offenders.push(`${rel}: ${m[0]}`);
        }
      }
    }
    assert.deepEqual(
      offenders.slice(0, 20),
      [],
      `a URL uses the display name "${offenders[0]?.split('/').pop()}" where the slug is ` +
        `"${repo}". GitHub redirects that to the real repo, so the link RESOLVES — to ` +
        `whatever issue or PR happens to hold that number here, which is not what the ` +
        `author meant (#12).\n  ` +
        offenders.slice(0, 20).join('\n  ') +
        (offenders.length > 20 ? `\n  … and ${offenders.length - 20} more` : '')
    );
  });

  /**
   * The specific 40 this ticket was about. They belong upstream, where the content lives.
   * A rebrand script that runs again would rewrite them straight back.
   */
  it('inherited issue links point at the upstream repo, not this one', () => {
    const offenders = [];
    for (const rel of FILES) {
      const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      for (const m of body.matchAll(
        /https:\/\/github\.com\/[^/\s)]+\/geo[Ll][Aa][Rr][Pp]\/issues\/\d+/g
      )) {
        offenders.push(`${rel}: ${m[0]}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'an issue URL was rewritten into this repository again. These 40 originally pointed ' +
        'at TortoiseWolfe/ScriptHammer, where the content still exists — and where it ' +
        'should stay.\n  ' +
        offenders.join('\n  ')
    );
  });

  it('the matcher can fail', () => {
    // Without this, a walker that read nothing would satisfy both assertions above.
    const re = new RegExp(
      `github\\.com/${owner}/(?!${repo}\\b)([A-Za-z0-9._-]+)`
    );
    assert.ok(re.test(`https://github.com/${owner}/geoLARP/issues/1`));
    assert.ok(!re.test(`https://github.com/${owner}/${repo}/issues/1`));
  });
});
