/**
 * No workflow may name a Supabase project by literal ref, and the drift gate may not
 * default one.
 *
 * WHY. `prod-schema-drift.yml` asked the Supabase Management API which schema production
 * actually has, and compared it to the repo. It resolved the project like this:
 *
 *     SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF || 'ozbdyopxmeqmwnfsmglp' }}
 *
 * That literal is **ScriptHammer's** project, inherited at the fork. geoLARP runs on
 * `xsnvwamytkniojrdnavt`.
 *
 * The fallback was not merely untidy — it disabled a guard that already existed.
 * `check-prod-schema-drift.mjs:195-199` refuses to run without `SUPABASE_PROJECT_REF` and
 * prints why. A default guarantees the variable is never empty, so that refusal can never
 * fire. Unset the repo variable and you would not get an error; you would get a **green run
 * against somebody else's database**, which is the most expensive possible answer: a gate
 * reporting success about a thing it is not looking at.
 *
 * WHY A TEST AND NOT JUST THE FIX. The fix is one line and the next person to hit a missing
 * variable in CI will reach for exactly the same one-line convenience, for exactly the same
 * sensible-sounding reason. This is the second time a fork-inherited identifier has been found
 * pointed at upstream (see `docs/` on the rebrand tail), and greps live in issue bodies nobody
 * re-runs.
 *
 * WHAT IT ALLOWS. Referencing `vars.SUPABASE_PROJECT_REF` or any other variable or secret is
 * fine — that is the correct shape. What is refused is a *literal* project ref in a workflow,
 * whoever it belongs to, because a literal cannot be repointed by a fork and reads as
 * configuration when it is really a hard-coded target.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WF_DIR = path.join(REPO_ROOT, '.github', 'workflows');

// A Supabase project ref is 20 lowercase letters. Matched only inside quotes so prose in a
// comment cannot trip it — the point is a VALUE the workflow would use, not a mention.
const LITERAL_REF =
  /['"]([a-z]{20})\.supabase\.co['"]|['"]([a-z]{20})['"]\s*\}\}/g;

function workflows() {
  if (!fs.existsSync(WF_DIR)) return [];
  return fs
    .readdirSync(WF_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => ({
      name: f,
      body: fs.readFileSync(path.join(WF_DIR, f), 'utf-8'),
    }));
}

describe('no inherited Supabase project ref in workflows', () => {
  it('no workflow embeds a literal project ref as a value', () => {
    const offenders = [];
    for (const { name, body } of workflows()) {
      for (const m of body.matchAll(LITERAL_REF)) {
        offenders.push(`${name}: ${m[0].trim()}`);
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      'A workflow names a Supabase project by literal ref. Use a repo variable so a fork can ' +
        "repoint it — a literal is upstream's database wearing configuration's clothes:\n  " +
        offenders.join('\n  ')
    );
  });

  it('the drift gate does not default SUPABASE_PROJECT_REF', () => {
    const f = workflows().find((w) => w.name === 'prod-schema-drift.yml');
    assert.ok(f, 'prod-schema-drift.yml is missing — did it move?');

    const line = f.body
      .split('\n')
      .find((l) => l.includes('SUPABASE_PROJECT_REF:') && l.includes('${{'));
    assert.ok(
      line,
      'prod-schema-drift.yml no longer sets SUPABASE_PROJECT_REF from an expression'
    );

    assert.ok(
      !line.includes('||'),
      'SUPABASE_PROJECT_REF has a fallback again. check-prod-schema-drift.mjs already fails ' +
        'loudly when it is unset; a default makes that refusal unreachable and turns a missing ' +
        `variable into a green run against the wrong database.\n  ${line.trim()}`
    );
  });
});
