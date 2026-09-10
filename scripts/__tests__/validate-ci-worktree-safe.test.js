/**
 * `validate-ci.sh` must not validate somebody else's tree (#22).
 *
 * `.husky/pre-commit` and `.husky/pre-push` both know about worktrees. `validate-ci.sh`,
 * which pre-push calls, did not — and its failure mode was worse than not running.
 *
 * Pushing from a worktree printed:
 *
 *     env file /home/TurtleWolfe/repos/geolarp-brandmark/.env not found
 *     ❌ ESLint failed
 *     ❌ CI validation failed. Please fix issues before pushing.
 *
 * Nothing there says "your worktree has no .env, so docker compose could not start". It
 * reads as though ESLint found problems in the code being pushed. It had not run at all.
 *
 * THE DANGEROUS OUTCOME IS THE ONE THAT SUCCEEDS. `run_check` used
 * `docker compose exec -T geolarp`, and `exec` enters the container whose /app is the
 * PRIMARY checkout. From a worktree there are exactly two ways to make that work and both
 * are wrong: give the worktree its own COMPOSE_PROJECT_NAME and `exec` finds no container;
 * give it a .env naming the primary project and `exec` succeeds against a tree nobody is
 * pushing. The second is easy to reach by copying .env — which is why CLAUDE.md says never
 * to copy it verbatim into a worktree.
 *
 * A green pre-push that validated the wrong tree is worse than a red one.
 *
 * VERIFIED IN A REAL WORKTREE, not reasoned about — and that is how the first version of
 * the fix was caught guarding only `run_check`. `run_host_check` drives `docker compose`
 * itself rather than exec'ing into it, so it looked exempt; it failed with
 * "❌ Production build failed", the same misleading shape one function down.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = 'scripts/validate-ci.sh';
const src = fs.readFileSync(path.join(ROOT, SCRIPT), 'utf8');

describe('validate-ci.sh refuses to validate the wrong tree (#22)', () => {
  it('read a real script — a silent empty file is not a pass', () => {
    assert.ok(src.length > 2000, `${SCRIPT} did not read`);
    assert.match(src, /run_check\(\)/, 'run_check is gone; matchers stale');
    assert.match(
      src,
      /run_host_check\(\)/,
      'run_host_check is gone; matchers stale'
    );
  });

  /**
   * The same test `.husky/pre-commit` and `.husky/pre-push` use: `git rev-parse`
   * disagrees with itself in a linked worktree.
   */
  it('detects a worktree the same way the hooks do', () => {
    assert.match(
      src,
      /--git-dir[\s\S]{0,120}--git-common-dir/,
      'the worktree test is gone or no longer compares git-dir against git-common-dir'
    );
  });

  it('never reaches docker compose exec from a worktree', () => {
    // The guard must come BEFORE the exec, or the trap has already sprung.
    const guardAt = src.indexOf('IN_WORKTREE" = true');
    const execAt = src.indexOf('docker compose exec -T geolarp $command');
    assert.ok(guardAt > 0, 'the worktree guard is gone');
    assert.ok(execAt > 0, 'the exec call is gone; matchers stale');
    assert.ok(
      guardAt < execAt,
      'the guard runs AFTER the exec, so a worktree still validates the primary checkout'
    );
  });

  /**
   * BOTH runners. The first fix guarded only `run_check`, and a real worktree run showed
   * `run_host_check` failing with "Production build failed" — the same misleading message
   * this ticket is about.
   */
  it('guards run_host_check too, not only run_check', () => {
    const body = src.slice(src.indexOf('run_host_check() {'));
    const end = body.indexOf('\n}\n');
    const fn = body.slice(0, end > 0 ? end : 800);
    assert.match(
      fn,
      /IN_WORKTREE" = true/,
      'run_host_check is unguarded. It drives `docker compose` directly, so in a ' +
        'worktree it fails on the missing .env and blames the build instead.'
    );
  });

  /**
   * THE SUMMARY IS THE POINT. Skipping quietly and then printing "All CI checks passed!
   * Safe to push" would be the same defect wearing a friendlier face — a green that means
   * nothing.
   */
  it('never claims a pass when checks were skipped', () => {
    assert.match(
      src,
      /SKIPPED_IN_WORKTREE/,
      'nothing counts the skipped checks, so the summary cannot know about them'
    );
    assert.match(
      src,
      /Nothing above validated the code you are pushing/,
      'the summary does not tell a worktree pusher that nothing was validated'
    );
    // "Safe to push" must be reachable ONLY when nothing was skipped.
    const safeAt = src.indexOf('Safe to push');
    const guardAt = src.indexOf('SKIPPED_IN_WORKTREE" -gt 0');
    assert.ok(safeAt > 0 && guardAt > 0, 'matchers stale');
    assert.ok(
      guardAt < safeAt,
      '"Safe to push" is printed before the skip count is consulted, so a worktree run ' +
        'still reports a pass'
    );
  });

  it('the matchers can fail', () => {
    // Without this, a src that read as '' would satisfy every indexOf-based assertion
    // above by returning -1 and short-circuiting the comparisons.
    assert.ok(''.indexOf('IN_WORKTREE" = true') === -1);
    assert.throws(() => assert.match('', /SKIPPED_IN_WORKTREE/));
  });
});
