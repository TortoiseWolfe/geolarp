/**
 * The mail-policy guard must be able to say NO (#822).
 *
 * WHY IT EXISTS. DMARC, SPF, the DKIM key and the inbound MX all live in Cloudflare's
 * dashboard, not in this tree. #822 says so explicitly under "Not automatable from this
 * repo", and draws the parallel to #635, where the cache rules lived outside the repo and
 * the next detector was a human opening a browser and seeing a white page.
 *
 * For mail the failure is silent in both directions, which is worse:
 *
 *   - lose the MX and `admin@` stops receiving, so the security policy (#881) quietly goes
 *     back to dropping vulnerability reports;
 *   - lose the DKIM key and transactional mail stops aligning — invisible while `p=none`,
 *     and it only surfaces as quarantined payment receipts once enforcement is raised;
 *   - lose the DMARC record and the domain is spoofable again, with no signal at all.
 *
 * WHAT THIS PINS. That the checker reaches BOTH verdicts, over the real module rather than a
 * reimplementation of its rules — a checker only ever observed passing has not been shown to
 * work, which is the whole subject of #396.
 *
 * It deliberately does NOT hit the network. Live DNS belongs in `smoke.yml`, where a
 * post-deploy check is expected to talk to the outside world; a unit test that depends on
 * resolution would fail for reasons unrelated to the code and get skipped.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(ROOT, 'scripts', 'ci', 'check-mail-policy.mjs');
const SMOKE = path.join(ROOT, '.github', 'workflows', 'smoke.yml');

/**
 * A zone in the state this repo intends. Each case below breaks exactly one thing.
 *
 * RAISED TO `p=reject` WITH STRICT ALIGNMENT on 2026-09-07 (#83). Until then the zone
 * published exactly this policy while the repo declared `p=none`, and the checker was
 * correctly failing over the gap. What closed it was publishing a DKIM key — Resend was
 * configured and `resend._domainkey` verified — not relaxing the zone.
 */
const HEALTHY = {
  dmarc: ['v=DMARC1; p=reject; rua=mailto:admin@geolarp.com; aspf=s; adkim=s'],
  spf: ['v=spf1 include:_spf.mx.cloudflare.net ~all'],
  dkim: ['v=DKIM1; k=rsa; p=MIIBIjAN'],
  mx: ['10 route1.mx.cloudflare.net.'],
};

describe('the mail-policy guard (#822)', () => {
  it('exists and is wired into the post-deploy smoke run', () => {
    // Non-vacuity: a checker nothing invokes is the #396 shape in its purest form.
    assert.ok(fs.existsSync(CHECKER), `checker missing at ${CHECKER}`);
    assert.match(
      fs.readFileSync(SMOKE, 'utf8'),
      /check-mail-policy\.mjs/,
      'nothing runs check-mail-policy.mjs — a guard that is never invoked protects nothing'
    );
  });

  it('passes a zone that matches the declared intent', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.deepStrictEqual(evaluate(HEALTHY), []);
  });

  it('fails when the DMARC record is gone', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({ ...HEALTHY, dmarc: [] });
    assert.equal(f.length, 1);
    assert.match(f[0], /NO DMARC RECORD/);
  });

  it('fails when the published policy differs from the declared intent', async () => {
    // This is the point of declaring `p` in the repo: a dashboard edit nobody recorded
    // shows up here, and a DELIBERATE change is a one-line reviewable diff.
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({
      ...HEALTHY,
      dmarc: [
        'v=DMARC1; p=none; rua=mailto:admin@geolarp.com; aspf=s; adkim=s',
      ],
    });
    assert.equal(f.length, 1);
    assert.match(f[0], /intends p=reject/);
  });

  it('fails when aggregate reports have nowhere to go', async () => {
    // Without `rua` there is no evidence, and #822 cannot ever be finished.
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({
      ...HEALTHY,
      dmarc: ['v=DMARC1; p=reject; aspf=s; adkim=s'],
    });
    assert.equal(f.length, 1);
    assert.match(f[0], /does not report to/);
  });

  it('fails when DKIM or MX disappear — the two silent ones', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.match(evaluate({ ...HEALTHY, dkim: [] })[0], /no DKIM public key/);
    assert.match(
      evaluate({ ...HEALTHY, mx: [] })[0],
      /inbound mail is not being routed/
    );
  });

  it('treats duplicate DMARC records as broken, because receivers do', async () => {
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({
      ...HEALTHY,
      dmarc: [HEALTHY.dmarc[0], 'v=DMARC1; p=reject; aspf=s; adkim=s'],
    });
    assert.match(f[0], /receivers ignore all of them/);
  });

  it('fails when alignment is relaxed, even though p= is untouched', async () => {
    // The failure mode `p=` alone cannot see: `aspf=r` widens who may send as this
    // domain while the policy string still reads `reject`.
    const { evaluate } = await import(`file://${CHECKER}`);
    const f = evaluate({
      ...HEALTHY,
      dmarc: [
        'v=DMARC1; p=reject; rua=mailto:admin@geolarp.com; aspf=r; adkim=s',
      ],
    });
    assert.equal(f.length, 1);
    assert.match(f[0], /intends aspf=s/);
  });

  it('reports every fault at once rather than stopping at the first', async () => {
    // A guard that reports one problem per run turns a broken zone into several
    // round-trips, and the later faults get discovered one deploy at a time.
    const { evaluate } = await import(`file://${CHECKER}`);
    assert.equal(evaluate({ dmarc: [], spf: [], dkim: [], mx: [] }).length, 4);
  });

  /**
   * ONE FAILING MONITOR MUST NOT BLIND THE OTHERS (#100).
   *
   * The mail check had no `continue-on-error`, so a DNS disagreement aborted the job
   * and three unrelated monitors below it never ran — for a whole day. One of them is
   * the check that exists because production served a bundle pointing at a DELETED
   * Supabase project for hours behind entirely green checks (`smoke.yml:165-174`).
   *
   * The split matters and both halves are asserted: `continue-on-error` decides
   * whether the job STOPS at this step, the result step decides whether it FAILS.
   * Dropping the second half would turn a real mail failure into a silent pass, which
   * is strictly worse than the blinding this fixes.
   */
  it('does not abort the job, but still fails it, when the mail check fails', () => {
    const yml = fs.readFileSync(SMOKE, 'utf8');

    assert.match(
      yml,
      /id:\s*mail_policy/,
      'the mail step needs an id, or the result step cannot read its outcome'
    );
    assert.match(
      yml,
      /id:\s*mail_policy[\s\S]{0,200}?continue-on-error:\s*true|continue-on-error:\s*true[\s\S]{0,200}?id:\s*mail_policy/,
      'the mail step must not abort the job — the monitors after it never run (#100)'
    );

    // The half that keeps it fatal. Without this the check would pass silently.
    const result =
      /- name: Mail policy result[\s\S]*?(?=\n      - name:|$)/.exec(yml);
    assert.ok(
      result,
      'no "Mail policy result" step — the failure would be silent'
    );
    assert.match(
      result[0],
      /if:\s*always\(\)/,
      'a result step that can be skipped reports nothing, and a required check that ' +
        'never reports is pending forever rather than skipped'
    );
    assert.match(
      result[0],
      /steps\.mail_policy\.outcome.*failure|failure.*steps\.mail_policy\.outcome/s,
      'the result step must read the mail step outcome'
    );
    assert.match(
      result[0],
      /exit 1/,
      'a failing mail policy must still fail the job'
    );
  });

  it('declares the intent it is enforcing', async () => {
    const { INTENDED } = await import(`file://${CHECKER}`);
    assert.equal(
      INTENDED.dmarcPolicy,
      'reject',
      'the intended policy is no longer `reject`'
    );
    // Alignment is the half that can be relaxed WITHOUT touching `p=`, so a zone can
    // keep reading `p=reject` and quietly stop meaning it. Both tags are declared.
    assert.equal(INTENDED.dmarcAspf, 's', 'SPF alignment must stay strict');
    assert.equal(INTENDED.dmarcAdkim, 's', 'DKIM alignment must stay strict');
    assert.equal(
      INTENDED.dmarcRua,
      'admin@geolarp.com',
      'aggregate reports must go to an address that receives — see #881'
    );
  });
});
