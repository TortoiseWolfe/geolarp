/**
 * `uv.lock` must stay untracked, and the .gitignore rule must stay real (#17).
 *
 * It locked ZERO packages — the whole file was `version`, `revision` and
 * `requires-python` — because `pyproject.toml` declares only `[tool.ruff]` and no
 * `[project]` table for uv to resolve. Nothing in CI or `.pre-commit-config.yaml` invokes
 * uv, so nothing read it either.
 *
 * WHAT IT ACTUALLY COST, which is why this is worth a test rather than a one-line commit:
 * uv regenerates `requires-python` from whichever Python is installed, so the tracked copy
 * was permanently dirty and a routine `git add -A` swept it into an unrelated commit about
 * Playwright env forwarding. It was amended out. Two contributors on different Python
 * versions would have fought over it indefinitely.
 *
 * WHY BOTH ASSERTIONS. CLAUDE.md records the trap this repo has already been caught by:
 * "A `.gitignore` rule for an already-tracked file does nothing, and `git check-ignore` will
 * tell you it is 'not ignored' because it is index-aware." `public/manifest.json` sat that
 * way for months — ignored on paper, tracked in fact. So this checks the index AND the rule
 * separately; either alone can pass while the other is broken.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

describe('uv.lock stays untracked (#17)', () => {
  it('is not in the index', () => {
    const tracked = git(['ls-files', 'uv.lock']);
    assert.strictEqual(
      tracked,
      '',
      'uv.lock is tracked again. It locks no packages and nothing reads it, but it ' +
        'regenerates on every `uv` invocation — so it sits dirty and rides into ' +
        'unrelated commits. `git rm --cached uv.lock` is the change; the .gitignore ' +
        'rule alone does nothing to an already-tracked file.'
    );
  });

  it('the .gitignore rule exists — checked with --no-index, the only way to see it', () => {
    // `git check-ignore` without --no-index consults the index first and reports a
    // TRACKED file as "not ignored", which is exactly how a dead rule looks alive.
    let out = '';
    try {
      out = git(['check-ignore', '--no-index', '-v', 'uv.lock']);
    } catch {
      assert.fail(
        'No .gitignore rule matches uv.lock. Untracking it without the rule means the ' +
          'next `uv` run re-adds it to `git status` and someone commits it back.'
      );
    }
    assert.match(
      out,
      /^\.gitignore:\d+:uv\.lock\tuv\.lock$/,
      `expected a literal uv.lock rule in .gitignore, got: ${out}`
    );
  });
});
