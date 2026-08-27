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
