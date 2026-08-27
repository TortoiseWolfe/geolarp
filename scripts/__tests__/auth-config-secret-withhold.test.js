/**
 * A withheld secret must degrade the patch, not destroy it (#9).
 *
 * `set-auth-config.ts` withholds a whole feature when its secret is absent —
 * SMTP with no password sends nothing, CAPTCHA with no secret rejects every
 * signup. That part is right and it is why this file does not simply delete
 * the rules.
 *
 * What was wrong is that `rate_limit_email_sent` is not an smtp_* field but
 * Supabase couples it to one: raising the email rate limit is only permitted on
 * a project with custom SMTP. Withholding the smtp_* fields while still sending
 * that one had the Management API reject the ENTIRE patch —
 *
 *   401 Custom SMTP required to configure SMTP_SENDER_NAME or
 *       RATE_LIMIT_EMAIL_SENT. Missing SMTP_ADMIN_EMAIL, SMTP_HOST, SMTP_PORT,
 *       SMTP_USER, SMTP_PASS fields.
 *
 * — and a patch is atomic, so nothing at all was applied. The withhold was not
 * degrading gracefully; it made `--apply` impossible for anyone without
 * RESEND_API_KEY. That is how a live project sat on
 * `site_url: http://localhost:3000`, pointing every auth email at the user's
 * own machine, while the daily drift check reported it accurately the whole
 * time. The check was never the problem; the repair path was.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'supabase', 'set-auth-config.ts');

function smtpRuleFields() {
  const src = fs.readFileSync(SRC, 'utf8');
  const start = src.indexOf("label: 'SMTP'");
  assert.ok(start > 0, 'SMTP rule not found in set-auth-config.ts');
  const fieldsAt = src.indexOf('fields: [', start);
  const end = src.indexOf(']', fieldsAt);
  assert.ok(fieldsAt > 0 && end > fieldsAt, 'SMTP rule has no fields array');
  return src
    .slice(fieldsAt, end)
    .match(/'[a-z_]+'/g)
    .map((s) => s.replace(/'/g, ''));
}

test('withholding SMTP also withholds the field Supabase couples to it', () => {
  const fields = smtpRuleFields();
  assert.ok(
    fields.includes('rate_limit_email_sent'),
    'rate_limit_email_sent must be withheld alongside the smtp_* fields, or a ' +
      'secretless --apply is rejected 401 in full and NOTHING is applied — ' +
      'including site_url, which is the field that matters most'
  );
});

test('the smtp_* fields are all still withheld', () => {
  const fields = smtpRuleFields();
  for (const f of [
    'smtp_host',
    'smtp_port',
    'smtp_user',
    'smtp_admin_email',
    'smtp_sender_name',
  ]) {
    assert.ok(fields.includes(f), `${f} must stay withheld without a password`);
  }
});

test('the fields a secretless apply CAN land are not withheld by any rule', () => {
  // The point of the fix: these must survive so a project with no secrets can
  // still be repaired. site_url is the one that was breaking real users.
  const src = fs.readFileSync(SRC, 'utf8');
  const rulesAt = src.indexOf('const SECRET_RULES');
  const rulesEnd = src.indexOf('\n];', rulesAt);
  const rules = src.slice(rulesAt, rulesEnd);
  for (const f of [
    'site_url',
    'uri_allow_list',
    'jwt_exp',
    'rate_limit_verify',
    'hook_custom_access_token_enabled',
  ]) {
    assert.ok(
      !rules.includes(`'${f}'`),
      `${f} must NOT be withheld — it needs no secret, and withholding it ` +
        `would leave a secretless project unrepairable`
    );
  }
});

/**
 * `--check` must distinguish drift it can fix from drift it cannot assess (#9).
 *
 * `auth-config-drift.yml` passes only SUPABASE_ACCESS_TOKEN and the public
 * `vars.AUTH_*` — never RESEND_API_KEY, TURNSTILE_SECRET or the OAuth secrets.
 * So CI can never apply those fields, and a check that fails on ANY drift was
 * unsatisfiable there by construction. A permanently red required check is not
 * protection; it is how this one turned into background noise while `site_url`
 * pointed at localhost.
 *
 * The rule it must keep: "could not assess" is reported as loudly as a failure
 * and never reads as a pass. Same principle as the #459 contrast fallback.
 *
 * Verified behaviourally against the live project when written, in both
 * directions — 12 unassessable fields alone exited 0 and printed every one; a
 * deliberate `jwt_exp` 7200→3600 exited 1 and named it. These assertions guard
 * the shape so that stays true.
 */
test('--check separates unassessable fields from actionable drift', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const at = src.indexOf('if (args.check)');
  assert.ok(at > 0, 'check branch not found');
  const branch = src.slice(at, at + 2600);

  assert.ok(
    /unassessable/.test(branch),
    'check must compute which fields it cannot assess'
  );
  assert.ok(
    /const actionable = diff\.filter/.test(branch),
    'check must exit on ACTIONABLE drift, not on every difference'
  );
  assert.ok(
    /actionable\.length > 0[\s\S]{0,400}process\.exit\(1\)/.test(branch),
    'actionable drift must still fail the gate'
  );
});

test('--check never silently passes an unassessable field', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const at = src.indexOf('if (args.check)');
  const branch = src.slice(at, at + 2600);

  // The failure mode this guards: filtering the fields out and saying nothing,
  // which is indistinguishable from a clean project.
  assert.ok(
    /NOT ASSESSED/.test(branch),
    'unassessable fields must be announced, not filtered away in silence'
  );
  assert.ok(
    /for \(const d of blocked\)/.test(branch),
    'each unassessable field must be named individually, not just counted'
  );
});

test('the secret lookup drives BOTH withholding and assessability', () => {
  // One source of truth. If apply and check ever disagreed about whether a
  // secret is present, the gate would demand what apply refuses to do — which
  // is the bug this whole file exists for.
  const src = fs.readFileSync(SRC, 'utf8');
  const at = src.indexOf('if (args.check)');
  const branch = src.slice(at, at + 2600);
  assert.ok(
    /envOrDotenv\(rule\.envNames\)/.test(branch),
    'check must use the same envOrDotenv(rule.envNames) lookup as apply'
  );
});
