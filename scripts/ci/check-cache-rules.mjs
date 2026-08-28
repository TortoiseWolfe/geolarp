/**
 * The #635 Cloudflare rules still exist, read from the API rather than inferred
 * from an HTTP response (#10).
 *
 * WHY THIS EXISTS ALONGSIDE `check-cache-headers.mjs`, NOT INSTEAD OF IT. The two
 * answer different questions and neither substitutes for the other:
 *
 *   check-cache-headers.mjs  — what does a VISITOR actually receive?
 *   this script              — does the RULE that produces it still exist?
 *
 * The probe goes blind whenever the network path breaks, which is exactly what
 * happened for six days when Cloudflare began 403ing GitHub Actions runners. A
 * config read stays green while the edge serves something else entirely. Run both,
 * and a disagreement between them is itself the finding.
 *
 * The rules live in a Cloudflare dashboard rather than in this repo, so nothing in
 * a diff can show them changing. `check-cache-headers.mjs` names the gap in its own
 * header — "that needs a scheduled probe against the hosted project, in the shape of
 * auth-config-drift.yml" — and CLAUDE.md repeats it. This is that probe.
 *
 * READ-ONLY, ON PURPOSE. It issues GETs and nothing else. The token it wants needs
 * only `Zone / Zone Settings / Read` and `Zone / Firewall Services / Read`, scoped to
 * one zone. A token that could rewrite rules is a much larger blast radius for a
 * check whose whole job is to look.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... node scripts/ci/check-cache-rules.mjs
 */

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE = process.env.CLOUDFLARE_ZONE_ID || '';
const API = 'https://api.cloudflare.com/client/v4';

/**
 * UNASSESSABLE IS NOT PASS, AND IT IS NOT FAILURE EITHER.
 *
 * A fork has no Cloudflare zone and must not be failed for it. But a run that could
 * not look must never report the contract as holding — that is the whole disease
 * this repo keeps catching. So: exit 0 with a loud notice, and say plainly that
 * nothing was verified.
 */
if (!TOKEN || !ZONE) {
  const missing = [
    !TOKEN && 'CLOUDFLARE_API_TOKEN',
    !ZONE && 'CLOUDFLARE_ZONE_ID',
  ]
    .filter(Boolean)
    .join(' and ');
  console.log(
    `::notice::cache-rule drift NOT CHECKED — ${missing} unset. This is the ` +
      `expected state for a fork with no Cloudflare zone. Nothing was verified; ` +
      `do not read this run as "the cache rules are fine".`
  );
  process.exit(0);
}

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!body.success) {
    const why =
      (body.errors || []).map((e) => e.message).join('; ') || res.status;
    throw new Error(`${path} failed: ${why}`);
  }
  return body.result;
}

const failures = [];

/** The document rule: without it GitHub Pages' own max-age=600 reaches browsers. */
async function checkDocumentRevalidation() {
  const entry = await get(
    `/zones/${ZONE}/rulesets/phases/http_response_headers_transform/entrypoint`
  );
  const rules = (entry && entry.rules) || [];
  const setsNoCache = rules.filter(
    (r) =>
      r.enabled &&
      JSON.stringify(r.action_parameters || {}).match(/no-cache|no-store/i)
  );
  if (setsNoCache.length === 0) {
    failures.push(
      'no ENABLED response-header transform rule sets `cache-control: no-cache` ' +
        'on documents. Without it GitHub Pages serves max-age=600 and a visitor ' +
        'can hold HTML pointing at assets a later deploy deleted — the #635 ' +
        'failure, which reached production eight times.'
    );
  } else {
    console.log(
      `  ok  document revalidation: ${setsNoCache.length} enabled rule(s) — ` +
        setsNoCache.map((r) => r.description || r.id).join(', ')
    );
  }
}

/** Belt to the transform rule's braces: the zone must still be answering. */
async function checkZoneReachable() {
  const zone = await get(`/zones/${ZONE}`);
  console.log(`  ok  zone: ${zone.name} (${zone.status})`);
  if (zone.status !== 'active') {
    failures.push(
      `zone ${zone.name} is "${zone.status}", not active — the edge rules below ` +
        `may not be applied to live traffic at all.`
    );
  }
}

try {
  await checkZoneReachable();
  await checkDocumentRevalidation();
} catch (err) {
  console.error(`::error::${err.message}`);
  console.error(
    '\nCould not read the Cloudflare configuration. This is a FAILURE TO MEASURE, ' +
      'not evidence about the cache contract — check the token scopes ' +
      '(Zone Settings: Read, Firewall Services: Read) and the zone id.'
  );
  process.exit(1);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`::error::${f}`);
  console.error(
    `\n${failures.length} cache-rule drift finding(s). These rules live in a ` +
      `Cloudflare dashboard, so no commit will ever show them changing — which is ` +
      `why this runs on a schedule rather than only on a diff.`
  );
  process.exit(1);
}

console.log(
  '\ncache rules intact: the #635 configuration is present and enabled.'
);
