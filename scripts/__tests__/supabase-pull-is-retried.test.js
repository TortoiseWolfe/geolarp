/**
 * The Supabase image pull is retried; the stack start-up is not (#174).
 *
 * Docker Hub refuses anonymous tokens under load, and Actions runners share egress
 * addresses. Twice on 2026-09-11 `Bring up local Supabase` died before a single test ran —
 * once on `supabase/postgres`, once on `postgrest/postgrest` — each costing a re-run of a
 * 26-job lane behind a required check.
 *
 * WHY A RETRY IS NOT THE MISTAKE THIS REPO KEEPS MAKING. CLAUDE.md records nine rounds of
 * "flake mitigation" that attacked symptoms while a shared Supabase project was the real
 * cause. The difference here is what is wrapped: a network fetch from a third party, with
 * the actual fix (authenticating to Docker Hub) needing credentials this repo does not
 * have. It makes the lane survive the flake; it does not pretend to remove it.
 *
 * AND THE LINE THAT MATTERS MOST IS THE ONE NOT CROSSED. The obvious way to make this
 * quieter is to soften the step that fails a shard which executed nothing. That step is
 * the only reason the flake is visible rather than silent — its own comment records 24
 * green jobs while firefox and webkit ran zero tests. The last assertion here exists to
 * stop a future "fix" going that way.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LANE = '.github/workflows/e2e-local.yml';
const src = fs.readFileSync(
  path.join(path.resolve(__dirname, '..', '..'), LANE),
  'utf8'
);

describe('the Supabase pull is retried, the start-up is not (#174)', () => {
  it('retries the image pull', () => {
    assert.match(
      src,
      /for attempt in 1 2 3; do\s*\n\s*if docker compose --profile supabase pull/,
      `${LANE} no longer retries the image pull. Docker Hub token refusals killed two ` +
        `lane runs in one day; without this the next one blocks a merge for a reason ` +
        `that has nothing to do with the change under test.`
    );
  });

  it('fails loudly when every attempt fails, rather than starting a broken stack', () => {
    assert.match(
      src,
      /could not pull the Supabase images after 3 attempts/,
      `${LANE} must say the pull exhausted its retries. A silent fall-through starts the ` +
        `stack with missing images and surfaces as unrelated product errors.`
    );
  });

  it('does NOT retry `up`, so a real start-up failure still fails fast', () => {
    // The distinction is the whole argument for the retry being legitimate. Retrying `up`
    // would turn a genuine compose error into three slow identical failures.
    const ups = src.match(/docker compose --profile supabase up -d/g) ?? [];
    assert.strictEqual(
      ups.length,
      1,
      `${LANE} starts the stack ${ups.length} times. \`up\` must run exactly once: the ` +
        `retry is for the registry fetch, and wrapping start-up too would mask real ` +
        `compose failures behind a slow loop.`
    );
  });

  it('still fails a shard that executed nothing — do not quieten the flake here', () => {
    assert.match(
      src,
      /This shard must have executed something, and it must have passed/,
      `${LANE} no longer fails a shard that ran zero tests. That step is what makes a ` +
        `failed bring-up visible instead of silent — its own comment records 24 green ` +
        `jobs while two browsers executed nothing. Softening it to reduce #174's noise ` +
        `trades a loud known problem for a quiet unknown one.`
    );
  });
});
