/**
 * The `accessibility` job's failure comment must be able to post (#25).
 *
 * The last step of a REQUIRED workflow posts a PR comment when the job fails. It
 * carried no `permissions` block, so `GITHUB_TOKEN` got the repository default
 * and `createComment` answered `Resource not accessible by integration`.
 *
 * WHY A TEST RATHER THAN JUST THE FIX. The step is guarded by `failure()`, so it
 * runs only on an already-red job — the one state nobody wants extra noise in,
 * and the one state no green PR ever exercises. Nothing in CI will ever notice
 * this regressing. Reading the workflow file is the only check available.
 *
 * `contents: read` is asserted too: naming any permission drops every unnamed one
 * to none, so omitting it breaks `actions/checkout` on every PR in the repo.
 *
 * Parsed as TEXT, following `e2e-local-triggers.test.js` rather than adding a YAML
 * dependency for four assertions — and, as there, every assertion is preceded by
 * one proving the parser found the thing it is asserting about.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW = path.resolve(
  __dirname,
  '..',
  '..',
  '.github',
  'workflows',
  'accessibility.yml'
);
const wf = fs.readFileSync(WORKFLOW, 'utf8');

/** The `permissions:` mapping declared at JOB level (four-space keys under it). */
function jobPermissions(src) {
  const m = src.match(/^ {4}permissions:\n((?: {6}\S[^\n]*\n)+)/m);
  return m ? m[1] : '';
}

describe('accessibility.yml can report its own failure', () => {
  it('the parser found the workflow and its job — a silent miss is not a pass', () => {
    assert.ok(wf.length > 1000, 'accessibility.yml did not read');
    assert.match(wf, /^ {2}accessibility:$/m, 'no accessibility job found');
    assert.ok(
      jobPermissions(wf).length > 0,
      'no job-level permissions: block found — the matcher is stale, and every ' +
        'assertion below would pass or fail for the wrong reason'
    );
  });

  it('still has the comment step this is about', () => {
    assert.match(
      wf,
      /- name: Comment PR with results/,
      'the comment step is gone. If that was deliberate, delete this file too — ' +
        'it asserts a permission nothing needs any more.'
    );
    const step = wf.slice(wf.indexOf('- name: Comment PR with results'));
    assert.match(
      step.split('\n').slice(0, 3).join('\n'),
      /failure\(\)/,
      'the comment step lost its failure() guard, so it comments on green runs'
    );
  });

  it('grants pull-requests: write, or the comment 403s exactly when it matters', () => {
    assert.match(jobPermissions(wf), /^ {6}pull-requests: write$/m);
  });

  it('restates contents: read, which naming any permission would otherwise drop', () => {
    assert.match(jobPermissions(wf), /^ {6}contents: read$/m);
  });

  it('the matcher can fail', () => {
    // Without this, a `jobPermissions` that always returned '' would make the two
    // assertions above fail loudly — but one that returned the WHOLE FILE would
    // make them pass for the wrong reason, matching a permissions block belonging
    // to some other job entirely.
    assert.strictEqual(jobPermissions('jobs:\n  x:\n    runs-on: y\n'), '');
    assert.match(
      jobPermissions('    permissions:\n      pull-requests: write\n'),
      /pull-requests: write/
    );
  });
});
