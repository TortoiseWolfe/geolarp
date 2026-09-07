#!/usr/bin/env node
/**
 * Assert that the LIVE mail policy for the domain is still what this repo intends (#822).
 *
 * WHY THIS EXISTS. The DMARC record, the SPF record, the DKIM key and the inbound MX all live
 * in Cloudflare's dashboard, not in this tree. Nothing here would notice if one were deleted,
 * a token rotated, or the zone moved — which is exactly the gap #635 documented for the cache
 * rules, where the next detector was a human opening a browser.
 *
 * For mail the failure is worse, because it is SILENT IN BOTH DIRECTIONS:
 *
 *   - Lose the MX and `admin@` stops receiving. The security policy (#881) starts dropping
 *     vulnerability reports again, and nobody here sees a thing — the reporter gets a bounce.
 *   - Lose the DKIM key and transactional mail stops aligning. Under `p=none` nothing visibly
 *     breaks, so the damage is invisible until enforcement is raised, at which point real
 *     payment receipts start being quarantined.
 *   - Lose the DMARC record and the domain is spoofable again, silently.
 *
 * WHAT IT IS NOT. This does not verify that mail is DELIVERED, and it cannot: that needs a
 * receiver's aggregate reports, which arrive by email days later. It asserts the published
 * policy matches the declared intent below. That is the difference between "the config we
 * meant is still there" and "mail works" — and only the first is checkable from CI.
 *
 * RAISING ENFORCEMENT. `p=` is declared here on purpose. Tightening the policy is then a
 * one-line, reviewable change in this repo that CI enforces against live DNS, instead of an
 * undocumented dashboard edit nothing records. See #822 for why it is still `none`.
 *
 * USAGE
 *   node scripts/ci/check-mail-policy.mjs [domain]     # default geolarp.com
 *   node scripts/ci/check-mail-policy.mjs --selftest
 */

const DOH = 'https://cloudflare-dns.com/dns-query';

/**
 * The mail policy this repository intends to be published.
 *
 * `p: 'reject'` as of 2026-09-07, with strict alignment. This is a RAISE, and the two
 * preconditions the previous note set are now met or moot:
 *
 *   1. A DKIM key is published. Resend was configured for `geolarp.com` and
 *      `resend._domainkey` verified, so mail sent through it aligns on DKIM. Until that
 *      day the zone published `p=reject; aspf=s; adkim=s` with NO key at all — the
 *      strictest possible policy over no authentication, which is why this check was
 *      failing rather than merely disagreeing.
 *   2. The `rua` evidence argument no longer gates it. Nothing sends as the domain except
 *      Resend, and Resend now aligns; the Supabase project still has `smtp_host = null`,
 *      so auth mail leaves via Supabase's own sender and never claims to be us.
 *
 * WHAT THIS COSTS, STATED PLAINLY. Under `adkim=s; aspf=s` anything sending as
 * `@geolarp.com` that is neither Resend nor in the root SPF is REJECTED, not quarantined.
 * A maintainer replying as `admin@` from a personal Gmail is in that set. That was already
 * true before this line changed — the zone has been at `p=reject` for some time — but the
 * repo now says so out loud instead of claiming to intend something gentler.
 *
 * The reference implementation is ScriptHammer, which runs `p=none` WITH DKIM. geoLARP is
 * deliberately stricter, and is only safe there because the key exists.
 */
export const INTENDED = {
  domain: 'geolarp.com',
  dmarcPolicy: 'reject',
  /**
   * Strict alignment, recorded so a silent relaxation is caught.
   *
   * `aspf=s; adkim=s` is what makes `p=reject` mean what it appears to mean: a subdomain
   * or a relaxed-alignment sender cannot pass on a cousin domain. Dropping either tag
   * would widen who may send as us without changing `p=`, and nothing else here would
   * notice — which is the exact shape of silence this file exists to break.
   */
  dmarcAspf: 's',
  dmarcAdkim: 's',
  // Aggregate reports must go somewhere that actually receives — see #881, where the
  // published security address had no mail route at all.
  dmarcRua: 'admin@geolarp.com',
  spfInclude: '_spf.mx.cloudflare.net',
  dkimSelector: 'resend',
  mxSuffix: 'mx.cloudflare.net',
};

async function txt(name) {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`DoH ${res.status} for TXT ${name}`);
  const body = await res.json();
  return (body.Answer ?? []).map((a) => String(a.data).replace(/^"|"$/g, ''));
}

async function mx(name) {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=MX`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!res.ok) throw new Error(`DoH ${res.status} for MX ${name}`);
  const body = await res.json();
  return (body.Answer ?? []).map((a) => String(a.data));
}

/** Parse a DMARC TXT record into its tags. */
export function parseDmarc(record) {
  const out = {};
  for (const part of record.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k && rest.length) out[k.trim()] = rest.join('=').trim();
  }
  return out;
}

/**
 * Evaluate the observed DNS against INTENDED. Pure, so both directions are testable without
 * a network — a checker only ever seen passing has not been shown to work.
 */
export function evaluate(observed, intended = INTENDED) {
  const failures = [];

  const dmarcRecords = (observed.dmarc ?? []).filter((r) => r.startsWith('v=DMARC1'));
  if (dmarcRecords.length === 0) {
    failures.push(
      'NO DMARC RECORD at _dmarc.' +
        intended.domain +
        ' — the domain is spoofable and nothing else here would notice'
    );
  } else if (dmarcRecords.length > 1) {
    // Receivers treat multiple DMARC records as none at all.
    failures.push(`${dmarcRecords.length} DMARC records published; receivers ignore all of them`);
  } else {
    const tags = parseDmarc(dmarcRecords[0]);
    if (tags.p !== intended.dmarcPolicy) {
      failures.push(
        `DMARC p=${tags.p ?? '<absent>'} but this repo intends p=${intended.dmarcPolicy}. ` +
          'If the change was deliberate, update INTENDED in this file so the intent is recorded.'
      );
    }
    for (const [tag, want] of [
      ['aspf', intended.dmarcAspf],
      ['adkim', intended.dmarcAdkim],
    ]) {
      if (want && tags[tag] !== want) {
        failures.push(
          `DMARC ${tag}=${tags[tag] ?? '<absent>'} but this repo intends ${tag}=${want}. ` +
            'Relaxing alignment widens who may send as this domain without touching p=, ' +
            'so it would not show up as a policy change.'
        );
      }
    }
    if (!tags.rua || !tags.rua.includes(intended.dmarcRua)) {
      failures.push(
        `DMARC rua=${tags.rua ?? '<absent>'} does not report to ${intended.dmarcRua}; ` +
          'without aggregate reports there is no evidence for raising enforcement'
      );
    }
  }

  const spf = (observed.spf ?? []).filter((r) => r.startsWith('v=spf1'));
  if (spf.length === 0) {
    failures.push(`no SPF record on ${intended.domain}`);
  } else if (!spf.some((r) => r.includes(intended.spfInclude))) {
    failures.push(`SPF does not include ${intended.spfInclude}: ${spf.join(' | ')}`);
  }

  if (!(observed.dkim ?? []).some((r) => r.includes('p='))) {
    failures.push(
      `no DKIM public key at ${intended.dkimSelector}._domainkey.${intended.domain} — ` +
        'transactional mail would stop aligning, invisibly while p=none'
    );
  }

  if (!(observed.mx ?? []).some((r) => r.includes(intended.mxSuffix))) {
    failures.push(
      `MX does not point at ${intended.mxSuffix} — inbound mail is not being routed, so ` +
        'admin@ stops receiving and the security policy (#881) silently breaks again'
    );
  }

  return failures;
}

async function main(argv) {
  if (argv.includes('--selftest')) {
    // Fixtures track INTENDED. When the policy was raised to `p=reject` with strict
    // alignment (2026-09-07) the old `good` zone started failing three checks, which is
    // the fixtures doing their job — a "correct zone" that no longer matches the declared
    // intent is exactly what this file exists to catch.
    const good = {
      dmarc: ['v=DMARC1; p=reject; rua=mailto:admin@geolarp.com; aspf=s; adkim=s'],
      spf: ['v=spf1 include:_spf.mx.cloudflare.net ~all'],
      dkim: ['v=DKIM1; k=rsa; p=MIIBIjAN'],
      mx: ['10 route1.mx.cloudflare.net.'],
    };
    const cases = [
      [good, 0, 'a correct zone passes'],
      [{ ...good, dmarc: [] }, 1, 'a missing DMARC record fails'],
      [{ ...good, dmarc: ['v=DMARC1; p=none; rua=mailto:admin@geolarp.com; aspf=s; adkim=s'] }, 1, 'an undeclared policy change fails'],
      // Alignment is the half that can be relaxed WITHOUT touching `p=`, so a zone that
      // still reads `p=reject` can quietly stop meaning it. Both tags are covered.
      [{ ...good, dmarc: ['v=DMARC1; p=reject; rua=mailto:admin@geolarp.com; aspf=r; adkim=s'] }, 1, 'relaxed SPF alignment fails even at p=reject'],
      [{ ...good, dmarc: ['v=DMARC1; p=reject; rua=mailto:admin@geolarp.com; aspf=s'] }, 1, 'a dropped adkim tag fails even at p=reject'],
      [{ ...good, dkim: [] }, 1, 'a missing DKIM key fails'],
      [{ ...good, mx: [] }, 1, 'a missing MX fails'],
      [{ ...good, spf: [] }, 1, 'a missing SPF fails'],
      [{ dmarc: [], spf: [], dkim: [], mx: [] }, 4, 'an empty zone fails everything'],
    ];
    let bad = 0;
    for (const [obs, want, label] of cases) {
      const got = evaluate(obs).length;
      if (got !== want) {
        console.error(`  selftest FAILED: ${label} — wanted ${want} failure(s), got ${got}`);
        bad++;
      }
    }
    if (bad) process.exit(1);
    console.log(`selftest ok: ${cases.length} cases, both answers reachable`);
    return;
  }

  const domain = argv.find((a) => !a.startsWith('--')) ?? INTENDED.domain;
  const intended = { ...INTENDED, domain };

  const observed = {
    dmarc: await txt(`_dmarc.${domain}`),
    spf: await txt(domain),
    dkim: await txt(`${intended.dkimSelector}._domainkey.${domain}`),
    mx: await mx(domain),
  };

  console.log(`[mail-policy] ${domain}`);
  console.log(`  DMARC : ${observed.dmarc.join(' | ') || '<none>'}`);
  console.log(`  SPF   : ${observed.spf.filter((r) => r.startsWith('v=spf1')).join(' | ') || '<none>'}`);
  console.log(`  DKIM  : ${observed.dkim.length ? 'present' : '<none>'}`);
  console.log(`  MX    : ${observed.mx.join(' | ') || '<none>'}`);

  const failures = evaluate(observed, intended);
  if (failures.length === 0) {
    console.log('[mail-policy] published policy matches the intent declared in this repo');
    return;
  }
  for (const f of failures) console.log(`::error::[mail-policy] ${f}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    // A DoH outage must not read as a clean zone.
    console.log(`::error::[mail-policy] could not resolve the domain's mail records: ${err.message}`);
    process.exit(1);
  });
}
