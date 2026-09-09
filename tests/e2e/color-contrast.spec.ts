import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import {
  seedIsolatedAdmin,
  deleteIsolatedAdmin,
  openAuthedPage,
  type IsolatedAdmin,
} from './utils/test-user-factory';
import { dirname, join } from 'node:path';
import { waitForLoadStateOrGiveUp } from './utils/settle';
import {
  measureNullRatioNodes,
  UNRESOLVABLE_ALLOWLIST,
  VENDOR_EXCLUDED,
} from './utils/contrast-fallback';
import { aaaFailures, isMeasuredRatio } from './utils/aaa-contrast';

// Pa11y's axe runner reports axe `incomplete` results as errors, which
// produces 14–61 false positives per page on DaisyUI — .btn gradients
// prevent axe from resolving a flat background color, so every button
// lands in the needs-review bucket. That's why config/pa11yci.json keeps
// color-contrast (and color-contrast-enhanced) in its ignore list.
//
// This spec is the real contrast gate. It enforces WCAG AAA — 7:1 normal text,
// 4.5:1 large — but it does NOT use axe's AAA rule to do it.
//
// WHY NOT (#43). `color-contrast-enhanced` is INERT in axe-core 4.10.2: it
// measures a ratio and never compares it to a threshold. Measured on a bare <p>
// at #9a9a9a on #bcbcbc, 13px normal — 1.48:1 against a 7:1 requirement:
//
//     color-contrast (AA)      -> 1 violation, expectedContrastRatio "4.5:1"
//     color-contrast-enhanced  -> 0 violations, 1 PASS,
//                                 "Element has sufficient color contrast of 1.4817"
//
// This spec asserted on that rule's `violations` for months. It was asserting on
// a path that cannot produce one, while reporting hundreds of passes that read
// as coverage. A gate that cannot fail is worse than no gate, because it is
// counted as protection.
//
// So the AA rule does the measuring — it is correct, and unlike the AAA rule it
// returns fgColor/bgColor/fontSize on PASSES as well as violations — and the AAA
// thresholds are applied to its numbers in utils/aaa-contrast.ts. A node that
// clears AA but not AAA is an axe PASS, and that is exactly the population this
// gate exists for, so passes are read, not just violations.
//
// The AAA target itself is unchanged and comes from #21 Phase 0:
// features/foundation/001-wcag-aa-compliance/spec.md was written for AAA while
// the code had drifted to AA. What changed is only HOW it is measured.

// axe-core is a transitive dep under pnpm's strict node_modules; resolve it
// through jest-axe (direct dep) so the path survives lockfile bumps.
// Playwright's TS transform runs as CJS, so `require` is ambient here.
const jestAxeEntry: string = require.resolve('jest-axe');
const axePath: string = require.resolve('axe-core/axe.min.js', {
  paths: [dirname(jestAxeEntry)],
});
const axeSource = readFileSync(axePath, 'utf8');

interface ContrastNodeData {
  fgColor?: string;
  bgColor?: string;
  contrastRatio?: number;
  expectedContrastRatio?: string;
  fontSize?: string;
  fontWeight?: string;
}

interface AxeNode {
  target?: string[];
  html?: string;
  any?: Array<{ data?: ContrastNodeData; message?: string }>;
}

interface AxeRuleResult {
  id: string;
  nodes: AxeNode[];
}

interface AxeResults {
  violations: AxeRuleResult[];
  incomplete: AxeRuleResult[];
  passes: AxeRuleResult[];
}

// Both custom themes covered — Pa11y's headless Chromium defaults to
// prefers-color-scheme: light, so before this spec the dark palette had
// no automated contrast coverage at all.
const THEMES = ['geolarp-light', 'geolarp-dark'] as const;

/**
 * ROUTES ARE ENUMERATED, NOT LISTED (#411).
 *
 * This list used to be four hand-written paths mirroring `config/pa11yci.json`.
 * That covered 4 of this app's 43 routes — 9% — and a 6.44:1 eyebrow reached
 * main on /blog with 17 green checks because /blog simply was not looked at.
 * A green run meant "these four pages meet AAA", which is not what anyone read
 * it as.
 *
 * Deriving from `src/app/**\/page.tsx` means a new route is covered the day it
 * is created, and opting one out is an explicit, visible entry below rather
 * than an omission nobody notices.
 *
 * The pa11y mirror is deliberately NOT maintained any more: pa11y ignores both
 * contrast rules entirely (see the header above), so mirroring it for a
 * contrast gate was never meaningful.
 */
const APP_DIR = join(process.cwd(), 'src/app');

/** Routes that cannot be measured, each with the reason. Never silent. */
const EXCLUDED: Record<string, string> = {
  '/auth/callback':
    'transient OAuth handler — redirects on load, there is no UI to measure',
  '/twins/[slug]':
    'twin payloads are privacy-gated and gitignored; absent in a fresh checkout',
  // Headless Firefox has no WebGL, so Cesium cannot construct and renders its
  // OWN error panel — `.cesium-widget-errorPanel-header`, measured at 6.49:1.
  // That is vendor markup we do not ship or control, appearing only in a
  // browser that cannot run the widget at all; chromium passed, which is why
  // the PR was green and `main` went red on the post-merge firefox shard.
  //
  // The route's real UI is not left unchecked: tests/e2e/twin-glass-contrast.spec.ts
  // measures the twin chrome against the scene directly, which is the contrast
  // question that actually matters here.
  '/chatt':
    'Cesium error panel is vendor markup; headless Firefox has no WebGL',
  // #715/#719. This route runs a continuous WebGL render loop, and on a runner with no GPU
  // Chromium composites the canvas through a SYNCHRONOUS GPU readback — a CDP category
  // trace of the sibling twin route measured `GLES2::ReadPixels` at 10.7 s inside a 13 s
  // window. The sweep's readiness wait never settles, so this fails by 30 s TIMEOUT and
  // reports no contrast violations at all. It failed identically on all three retries
  // across eight-plus consecutive `main` runs — deterministic, not flaky.
  //
  // NOTE WHAT THIS COSTS: the page's contrast is now genuinely unmeasured. That is a real
  // gap, tracked in #715, and the fix is a component-level contrast test that does not need
  // the live canvas — not a re-enable of this sweep, which cannot settle here at any timeout.
  // Coverage is NOT lost: tests/e2e/cod-skeleton-hud-contrast.spec.ts measures the HUD
  // chrome against a bracketed black/white scene without ever constructing a renderer —
  // the same move /chatt makes toward twin-glass-contrast.spec.ts. It found the chips at
  // 5.00:1 (light) and 4.51:1 (dark) and drove the fix to bg-base-300/90.
  '/game/cod-skeleton':
    'continuous WebGL render loop; the readiness wait cannot settle under software ' +
    'rendering (synchronous GPU readback, #719) — HUD chrome measured instead by ' +
    'cod-skeleton-hud-contrast.spec.ts',
};

/** Dynamic segments need a real instance — the template alone proves nothing. */
const INSTANCES: Record<string, string> = {
  '/blog/[slug]': '/blog/playable-city-chattanooga',
  // Was excluded with the reason "no post declares a tag". That was wrong: I
  // read `post.tags` at the top level, where nothing lives. Tags are under
  // `metadata.tags` — 53 distinct across 12 posts — and
  // blog/tags/[tag]/page.tsx:45 builds its params from exactly that field.
  '/blog/tags/[tag]': '/blog/tags/digital-twin',
  // Without this the sweep visits the literal path `/docs/[slug]`, which 404s
  // — so it measured the not-found page and reported the failure against
  // `/docs/[slug]`. That accident is what found #425; the 404 page's own
  // violation is fixed there, and bringing route templates into a gate is
  // tracked by it.
  '/docs/[slug]': '/docs/install-and-first-run',
};

function enumerateRoutes(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Route groups `(name)` and private folders `_name` contribute no URL
      // segment. `[slug]` DOES — an earlier version collapsed it too, which
      // merged /blog/tags/[tag] onto /blog/tags and produced duplicate test
      // titles that Playwright rejects outright.
      const seg =
        entry.name.startsWith('(') || entry.name.startsWith('_')
          ? ''
          : `/${entry.name}`;
      out.push(...enumerateRoutes(join(dir, entry.name), prefix + seg));
    } else if (entry.name === 'page.tsx') {
      out.push(prefix === '' ? '/' : prefix);
    }
  }
  return out;
}

/**
 * ROUTE TEMPLATES ARE NOT `page.tsx`, SO ENUMERATION CANNOT SEE THEM (#425).
 *
 * `enumerateRoutes` emits a route only for `page.tsx`. `not-found.tsx` and
 * `global-error.tsx` are neither, so a template that renders on EVERY bad URL
 * in the product sat outside this gate entirely — and it did have a violation:
 * `text-base-content/80` on the 404 page measured 6.62:1 against the 7:1 floor.
 *
 * Nobody found that on purpose. PR #420 added a `/docs/[slug]` route with no
 * `INSTANCES` entry, so the sweep visited the literal path, 404'd, and measured
 * the not-found page by accident — reporting the failure against `/docs/[slug]`
 * while the real subject was `not-found.tsx`.
 *
 * A template has no URL of its own, so it cannot be enumerated; it has to be
 * REACHED. The 404 renders on any unmatched path, so the sweep asks for one
 * deliberately. `TEMPLATE_MUST_CONTAIN` below then proves the probe actually
 * landed on the 404 page — without it, a path that started resolving to
 * something else would leave this measuring the wrong page and passing.
 */
const TEMPLATE_PROBES: Record<string, { source: string; contains: string }> = {
  '/__contrast-probe-unmatched-route__/': {
    source: 'src/app/not-found.tsx',
    contains: 'Page Not Found',
  },
};

/**
 * Templates that no navigation can reach, recorded rather than left silent —
 * the same contract as EXCLUDED above.
 */
const UNREACHABLE_TEMPLATES: Record<string, string> = {
  'src/app/global-error.tsx':
    'renders only when the ROOT layout itself throws. No URL reaches it, and a ' +
    'static export offers no way to induce that from a navigation, so this gate ' +
    'cannot measure it. Clean by inspection today; if it grows real UI it needs ' +
    'a component-level contrast test, not a route sweep.',
};

const ALL = enumerateRoutes(APP_DIR).sort();
const SKIPPED = ALL.filter((r) => r in EXCLUDED);
const PAGES = [
  ...ALL.filter((r) => !(r in EXCLUDED)).map((r) => INSTANCES[r] ?? r),
  ...Object.keys(TEMPLATE_PROBES),
];

// Loudly, so a shrinking sweep can never read as a passing one.
console.log(
  `[color-contrast] sweeping ${PAGES.length} paths ` +
    `(${ALL.length - SKIPPED.length} of ${ALL.length} routes + ` +
    `${Object.keys(TEMPLATE_PROBES).length} route template(s)) x ${THEMES.length} themes` +
    (SKIPPED.length
      ? `\n[color-contrast] excluded ${SKIPPED.length}:\n` +
        SKIPPED.map((r) => `  - ${r}: ${EXCLUDED[r]}`).join('\n')
      : '') +
    `\n[color-contrast] route templates reached by probe:\n` +
    Object.entries(TEMPLATE_PROBES)
      .map(([p, t]) => `  - ${t.source} via ${p}`)
      .join('\n') +
    `\n[color-contrast] route templates NOT measurable here:\n` +
    Object.entries(UNREACHABLE_TEMPLATES)
      .map(([f, why]) => `  - ${f}: ${why}`)
      .join('\n')
);

/**
 * THE contrast measurement, in one place (#43).
 *
 * Extracted so `the AAA gate can fail` below runs byte-identically to the
 * sweep. A can-fail proof against a different axe configuration proves nothing
 * about the configuration that actually gates merges.
 */
async function runAxeContrast(
  page: import('@playwright/test').Page
): Promise<AxeResults> {
  await page.evaluate(axeSource);
  return page.evaluate<AxeResults>(async () => {
    // Playwright RETRIES an evaluate whose execution context is destroyed
    // mid-call — which is what a client-side redirect or a late hydration
    // does. A bare axe.run() then starts a second time while the first is
    // still in flight and throws "Axe is already running".
    //
    // Measured: 13 of the 40 routes hit this — /sign-in, /sign-up,
    // /account, /chatt, /wireframes and friends, i.e. exactly the ones
    // that navigate or mount late. Caching the promise on `window` makes
    // the retry return the original run instead of starting a rival one.
    const w = window as unknown as {
      __shAxeRun?: Promise<AxeResults>;
      axe: { run: (d: Document, o: unknown) => Promise<AxeResults> };
    };
    w.__shAxeRun ??= w.axe.run(document, {
      // 'color-contrast', NOT 'color-contrast-enhanced' (#43). The AAA
      // rule is INERT in axe-core 4.10.2: it measures a ratio and never
      // compares it to a threshold. On a 1.48:1 element it returns zero
      // violations and one PASS reading "Element has sufficient color
      // contrast of 1.4817". This suite asserted on its violations for
      // months — a path that cannot produce one — and reported hundreds of
      // passes that read as coverage.
      //
      // The AA rule measures correctly and, unlike the AAA rule, returns
      // fgColor/bgColor/fontSize/expectedContrastRatio on PASSES too. AAA
      // is therefore derived from its numbers in utils/aaa-contrast.ts.
      runOnly: { type: 'rule', values: ['color-contrast'] },
      // 'passes' IS LOAD-BEARING, NOT COMPLETENESS (#459). axe returns a
      // PASS for elements whose ratio it could not compute, with
      // `contrastRatio: null` — 120 of 608 across eight routes, one in
      // five. Those are unmeasured, not verified.
      //
      // And `resultTypes` does not merely filter the report: any group
      // NOT listed is TRUNCATED TO ONE NODE. Measured on /pricing —
      // without 'passes' axe returns 1 pass node, with it 96, of which 8
      // have a null ratio. So an audit of `passes` that forgets to ask
      // for them inspects a single element and calls the page clean,
      // which is #459 reproduced inside the fix for #459.
      resultTypes: ['violations', 'incomplete', 'passes'],
    });
    return w.__shAxeRun;
  });
}

test.describe('WCAG AAA, derived from color-contrast (#43)', () => {
  // Match pa11yci.json viewport.
  test.use({ viewport: { width: 1280, height: 1024 } });

  for (const theme of THEMES) {
    for (const path of PAGES) {
      test(`${theme} — ${path}`, async ({ page: defaultPage, browser }) => {
        // The six `/admin` routes need an ADMIN session (#454). Until now this
        // sweep listed them and measured THE HOME PAGE: `AdminGate.tsx:81`
        // redirects an authenticated non-admin to `/`, and nothing here
        // asserted the probe landed where it asked. A populated, AAA-clean home
        // page passed six times under other routes' names — not an absent
        // measurement, a WRONG one that read as coverage.
        const needsAdmin = path.startsWith('/admin');
        let adminFixture: IsolatedAdmin | null = null;
        let openedAdmin: Awaited<ReturnType<typeof openAuthedPage>> | null =
          null;
        let page = defaultPage;
        if (needsAdmin) {
          adminFixture = await seedIsolatedAdmin();
          test.skip(!adminFixture, 'Admin client unavailable to seed an admin');
          if (!adminFixture) return;
          openedAdmin = await openAuthedPage(browser, adminFixture.session);
          page = openedAdmin.page;
          await page.setViewportSize({ width: 1280, height: 1024 });
        }

        // ThemeScript.tsx reads localStorage.getItem('theme') before falling
        // back to prefers-color-scheme; seeding it in an init script runs
        // before that inline script.
        await page.addInitScript(
          (t) => window.localStorage.setItem('theme', t),
          theme
        );

        // NOT `networkidle`: /sign-in, /sign-up, /forgot-password and
        // /messages/setup mount Cloudflare Turnstile, so the network never goes
        // idle and the page never resolves. Measured — all four timed out at
        // 25s. Those are the routes handling credentials, so losing them is the
        // opposite of what this gate is for. domcontentloaded plus a settle
        // covers every route.
        //
        // The mechanism, measured precisely in #506: Turnstile opens a `blob:`
        // worker request that NEVER finishes — not periodic polling. This note
        // was accurate and still did not stop the same trap reaching CI in
        // `auth/session-persistence.spec.ts`, so it is now enforced by
        // tests/unit/no-networkidle-on-captcha-routes.test.ts.
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        // Give client-side redirects and hydration a chance to finish, so the
        // execution context is stable before axe is injected.
        await waitForLoadStateOrGiveUp(page, 'load');
        // 3000ms mirrored pa11yci's `wait` when this swept 4 pages; across the
        // full route list that is minutes of pure idling. 1200ms is the settle
        // that replaces the load-state guarantee given up above.
        await page.waitForTimeout(1200);

        // PROVE THE PROBE LANDED ON THE TEMPLATE IT CLAIMS TO MEASURE (#425).
        // This path only reaches not-found.tsx for as long as nothing else
        // resolves it. If that ever changes, the sweep would quietly measure a
        // different page and report it as template coverage — which is the
        // failure mode this whole ticket is about.
        // Same guarantee as the template probe below, for the admin routes:
        // a redirect here means everything measured belongs to another page.
        if (needsAdmin) {
          await expect(
            page,
            `${path}: redirected away before measuring. The admin fixture did ` +
              `not take, and axe would be reporting the home page under this ` +
              `route's name — which is #454 itself.`
          ).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}\\/?$`));
        }

        const probe = TEMPLATE_PROBES[path];
        if (probe) {
          await expect(
            page.getByText(probe.contains),
            `${path} must render ${probe.source} (looking for "${probe.contains}"); ` +
              `if it does not, this test is measuring the wrong page`
          ).toBeVisible();
        }

        const results = await runAxeContrast(page);

        // EVERY node axe measured, from all three groups — because with the
        // AA rule the interesting population is the PASSES. 4.6:1 clears AA
        // and fails AAA, so a node that fails this gate is, by construction,
        // one axe called a pass.
        const allNodes = [
          ...results.violations,
          ...(results.passes ?? []),
          ...results.incomplete,
        ].flatMap((r) => r.nodes);

        // THE INERT-RULE SENTINEL (#43). `expectedContrastRatio` is the field
        // 'color-contrast-enhanced' omits entirely — its data carries only
        // `contrastRatio`. If someone swaps the rule id back, this fails on
        // the first route instead of the suite quietly going all-green again.
        expect(
          allNodes.some(
            (n) => n.any?.[0]?.data?.expectedContrastRatio !== undefined
          ),
          `${path} [${theme}]: axe measured ${allNodes.length} node(s) and not ` +
            `one carried expectedContrastRatio. That is the signature of ` +
            `'color-contrast-enhanced', which is inert in axe-core 4.10.2 ` +
            `(#43) — this suite must run 'color-contrast' and derive AAA from ` +
            `its numbers.`
        ).toBe(true);

        // AAA judged HERE, against the measured ratio, rather than taken from
        // a rule verdict. Carries the fg/bg/ratio triple so a failure is
        // actionable without re-running a probe script.
        const details = aaaFailures(allNodes);

        const incompleteCount = results.incomplete.reduce(
          (n, v) => n + v.nodes.length,
          0
        );

        // UNMEASURED ELEMENTS AXE REPORTED AS PASSING (#459). A null ratio means
        // axe could not compute one — most often a background it cannot resolve
        // (an image, a gradient, a transparent stack). It is not a pass; it is a
        // question that was never answered, and it was being counted as covered.
        //
        // Drawn from ALL THREE groups, not just passes (#43). The inert AAA
        // rule filed everything as a pass, so `passes` was the whole world;
        // the AA rule puts a background it cannot resolve into `incomplete`
        // instead. Reading passes alone after the rule swap would have emptied
        // this bucket and retired the #459 coverage without a single test
        // going red.
        const unmeasured: string[] = allNodes
          // `!isMeasuredRatio`, not `=== null`. Axe reports an unresolvable
          // background as ratio 0 as well as null, and 0 is not a real ratio —
          // 1:1 is the floor. Testing only for null left 2,959 zeros to be
          // judged as contrast failures instead of routed here (#43).
          .filter((n) => !isMeasuredRatio(n.any?.[0]?.data?.contrastRatio))
          .map((n) => n.target?.[0])
          // A node axe cannot give a selector for cannot be re-resolved in the
          // page either, so it would only become a phantom "unresolvable".
          .filter((t): t is string => typeof t === 'string');
        const passCount = (results.passes ?? []).reduce(
          (n, v) => n + v.nodes.length,
          0
        );
        // Every node is measured or null-ratio; nothing may fall between the
        // two buckets unread.
        const measuredCount = allNodes.filter((n) =>
          isMeasuredRatio(n.any?.[0]?.data?.contrastRatio)
        ).length;
        const nullRatioCount = allNodes.length - measuredCount;
        expect(
          measuredCount + nullRatioCount,
          `${path} [${theme}]: ${allNodes.length} node(s) reported, ` +
            `${measuredCount} measured + ${nullRatioCount} null-ratio`
        ).toBe(allNodes.length);
        // MEASURE THEM OURSELVES (#459). Reporting the count was the previous
        // behaviour and it closed nothing — a printed number can grow for
        // months without anyone reading the log. Every one of these is text on
        // a gradient, which axe declines to compute but which is perfectly
        // computable from the gradient's stops. See utils/contrast-fallback.ts
        // for why worst-of-stops is the correct bound and why canvas readback
        // is the only thing that resolves this codebase's oklch() colours.
        const fallback = unmeasured.length
          ? await page.evaluate(measureNullRatioNodes, unmeasured)
          : [];

        const fallbackFailures = fallback
          .filter((r) => r.kind === 'measured' && r.ratio! < r.required!)
          // Vendor chrome we do not style. Named and reasoned in
          // VENDOR_EXCLUDED, never a bare threshold.
          .filter(
            (r) =>
              !VENDOR_EXCLUDED.some(
                (v) =>
                  r.selector.includes(v.selectorFragment) ||
                  r.signature.includes(v.selectorFragment)
              )
          )
          .map((r) => ({
            target: r.selector,
            html: `${r.signature}  "${r.text}"`,
            fg: r.fg,
            bg: r.bg,
            ratio: r.ratio,
            expected: r.required,
            note: `axe reported this as a PASS with contrastRatio: null (${r.mode})`,
          }));

        // Anything still unmeasurable must be a KNOWN category. Asserted as a
        // set rather than a count: a count stays green while one unresolvable
        // node appears and another is fixed.
        const unresolvedUnknown = fallback
          .filter((r) => r.kind === 'unresolvable')
          .filter(
            (r) =>
              !UNRESOLVABLE_ALLOWLIST.some(
                (a) =>
                  a.reason === r.reason &&
                  // Every matcher the entry declares must match, and an entry
                  // declaring neither matches nothing — an empty entry must not
                  // become a blanket exemption.
                  (a.signature !== undefined || a.blockedBy !== undefined) &&
                  (a.signature === undefined ||
                    a.signature.test(r.signature)) &&
                  (a.blockedBy === undefined ||
                    (r.blockedBy !== undefined &&
                      a.blockedBy.test(r.blockedBy)))
              )
          )
          .map(
            (r) =>
              `${r.signature} [${r.reason}]` +
              (r.blockedBy ? ` blocked by ${r.blockedBy}` : '') +
              ` "${r.text}"` +
              (r.baseColorRatio
                ? ` (base background-color alone would be ${r.baseColorRatio}:1)`
                : '')
          );

        const measuredByFallback = fallback.filter(
          (r) => r.kind === 'measured'
        ).length;
        const notVisible = fallback.filter(
          (r) => r.kind === 'not-visible'
        ).length;
        if (unmeasured.length) {
          console.log(
            `${path} [${theme}]: ${passCount} axe passes, ${unmeasured.length} with a ` +
              `null ratio -> ${measuredByFallback} measured by fallback, ` +
              `${notVisible} not visible, ` +
              `${fallback.length - measuredByFallback - notVisible} unresolvable`
          );
        }

        // Tear the throwaway admin down BEFORE the assertion, so a violation
        // does not leave a live admin account behind. `auth.setup.ts` sweeps
        // orphans, but a failing test is exactly when you least want to rely
        // on a backstop.
        if (openedAdmin) await openedAdmin.close();
        await deleteIsolatedAdmin(adminFixture);

        // A NEW unmeasurable CATEGORY is a failure, because the alternative is
        // the gate quietly shrinking again. Fix the element, or add an
        // allowlist entry that says why it cannot be measured.
        expect(
          unresolvedUnknown,
          `${path} [${theme}]: ${unresolvedUnknown.length} element(s) could not be ` +
            `measured and are not in UNRESOLVABLE_ALLOWLIST (tests/e2e/utils/` +
            `contrast-fallback.ts). axe reported them as PASSING with a null ` +
            `ratio, so leaving them here means they are unverified:\n  ` +
            unresolvedUnknown.join('\n  ')
        ).toEqual([]);

        // ONE assertion for both sources. axe's own violations and the ones it
        // declined to compute are the same defect to a user, so they fail the
        // same way and carry the same fg/bg/ratio dump.
        const allFailures = [...details, ...fallbackFailures];
        expect(
          allFailures,
          `WCAG AAA contrast failures on ${path} [${theme}] ` +
            `(${incompleteCount} incomplete/needs-review — expected, not a failure; ` +
            `${fallbackFailures.length} of these were measured by the #459 fallback ` +
            `after axe passed them with a null ratio):\n` +
            JSON.stringify(allFailures, null, 2)
        ).toHaveLength(0);
      });
    }
  }
});

// PROOF THE GATE CAN FAIL (#43).
//
// The defect this ticket names is not "a wrong threshold" — it is a suite that
// was structurally incapable of reporting a failure while printing hundreds of
// passes. A rule id is one token; nothing above would go red if it were swapped
// back tomorrow and every route would report clean. So the sweep's own
// measurement path is run here against two elements whose ratios are known, one
// on each side of the line, and the answer is asserted in both directions.
//
// Deliberately NOT a unit test of aaaFailures(). That would pass just as
// happily while the sweep ran the inert rule.
test.describe('the AAA gate can fail (#43)', () => {
  test.use({ viewport: { width: 1280, height: 1024 } });

  // #9a9a9a on #bcbcbc at 13px normal is 1.48:1 against a 7:1 requirement —
  // the exact element measured in the ticket, where color-contrast-enhanced
  // returned "Element has sufficient color contrast of 1.4817".
  const FAIL_ID = 'aaa-canfail-fixture';
  // Black on white is 21:1: the control. Without it, a gate that flagged
  // everything would look identical to a gate that works.
  const PASS_ID = 'aaa-control-fixture';
  // ~5.1:1 at 24px (18pt) — LARGE text, so AAA wants 4.5:1 and this clears it.
  //
  // THIS IS THE FIXTURE THAT DETECTS THE INERT RULE, and the two above are not.
  // `color-contrast-enhanced` returns `contrastRatio` but omits `fontSize`, so
  // `parsePt(undefined)` falls back to 12pt, "large" is never true, and the
  // threshold silently becomes 7:1 for everything. 5.1 < 7, so the inert path
  // flags this element and the correct path clears it. Measured: swapping the
  // sweep's `runOnly` back to the AAA rule turns this assertion red, which is
  // exactly what the two original fixtures failed to do — both are normal-size
  // text, where the 12pt fallback lands on the same 7:1 answer by coincidence.
  const LARGE_OK_ID = 'aaa-large-ok-fixture';

  test("flags 1.48:1 and clears 21:1, through the sweep's own path", async ({
    page,
  }) => {
    await page.goto('/');
    await waitForLoadStateOrGiveUp(page, 'load');

    await page.evaluate(
      ([failId, passId, largeOkId]) => {
        const add = (id: string, fg: string, bg: string) => {
          const el = document.createElement('p');
          el.id = id;
          el.textContent = 'contrast fixture';
          // Inline, explicit, opaque: axe must resolve a background here, or
          // the fixture lands in the null-ratio bucket and proves nothing.
          el.setAttribute(
            'style',
            `color:${fg};background-color:${bg};font-size:13px;` +
              `font-weight:400;padding:8px;position:static;opacity:1`
          );
          document.body.appendChild(el);
        };
        add(failId, '#9a9a9a', '#bcbcbc');
        add(passId, '#000000', '#ffffff');
        // Large text needs its own size, so it does not reuse `add`.
        const large = document.createElement('p');
        large.id = largeOkId;
        large.textContent = 'large contrast fixture';
        large.setAttribute(
          'style',
          'color:#6e6e6e;background-color:#ffffff;font-size:24px;' +
            'font-weight:400;padding:8px;position:static;opacity:1'
        );
        document.body.appendChild(large);
      },
      [FAIL_ID, PASS_ID, LARGE_OK_ID] as const
    );

    const results = await runAxeContrast(page);
    const allNodes = [
      ...results.violations,
      ...(results.passes ?? []),
      ...results.incomplete,
    ].flatMap((r) => r.nodes);

    const idOf = (n: { target?: string[]; html?: string }) =>
      `${n.target?.join(' ') ?? ''} ${n.html ?? ''}`;

    // The fixtures must be MEASURED, not merely present. A fixture axe skipped
    // would make both assertions below vacuous in the passing direction.
    const failNode = allNodes.find((n) => idOf(n).includes(FAIL_ID));
    const passNode = allNodes.find((n) => idOf(n).includes(PASS_ID));
    expect(failNode, `${FAIL_ID} was not measured by axe at all`).toBeTruthy();
    expect(passNode, `${PASS_ID} was not measured by axe at all`).toBeTruthy();
    expect(
      failNode!.any?.[0]?.data?.contrastRatio,
      'the failing fixture should measure ~1.48:1'
    ).toBeCloseTo(1.48, 1);

    const failures = aaaFailures(allNodes);

    expect(
      failures.map((f) => `${f.target} ${f.ratio}:1 < ${f.expected}:1`),
      `the 1.48:1 fixture must be flagged. If this is empty, the gate is inert ` +
        `again and every green run above means nothing.`
    ).toEqual(expect.arrayContaining([expect.stringContaining(FAIL_ID)]));

    expect(
      failures.filter((f) => `${f.target}`.includes(PASS_ID)),
      `the 21:1 control must NOT be flagged; a gate that fails everything is ` +
        `as useless as one that fails nothing`
    ).toEqual([]);

    // THE ASSERTIONS THAT ACTUALLY DETECT THE INERT RULE.
    //
    // Everything above passes whether the sweep runs `color-contrast` or
    // `color-contrast-enhanced` — measured, not assumed. The AAA rule returns a
    // `contrastRatio`, so the 1.48:1 fixture is still flagged and the 21:1
    // control still is not. What the AAA rule does NOT return is the rest of the
    // data, and that is what is checked here.
    expect(
      {
        fontSize: failNode!.any?.[0]?.data?.fontSize ?? null,
        fgColor: failNode!.any?.[0]?.data?.fgColor ?? null,
        bgColor: failNode!.any?.[0]?.data?.bgColor ?? null,
      },
      `axe returned no fontSize/fgColor/bgColor, which means the sweep is running ` +
        `'color-contrast-enhanced' again. That rule is inert in 4.10.2 and every ` +
        `green run above means nothing (#43).`
    ).toEqual({
      fontSize: expect.stringContaining('pt'),
      fgColor: expect.any(String),
      bgColor: expect.any(String),
    });

    // And the consequence of losing fontSize, stated as a behaviour rather than
    // a field: without it every element is judged at the 7:1 normal-text bar,
    // so legitimate large text gets flagged.
    expect(
      failures.filter((f) => `${f.target}`.includes(LARGE_OK_ID)),
      `5.1:1 at 24px clears AAA for large text (4.5:1) and must NOT be flagged. ` +
        `If it is, the sweep lost fontSize and is judging everything at 7:1.`
    ).toEqual([]);
  });

  /**
   * THE FALLBACK MUST NOT REPORT BLACK AS UNPARSEABLE (#43).
   *
   * `rgbOf` detects an invalid colour by assigning it to `ctx.fillStyle` and
   * checking the value did not move — an invalid assignment is silently ignored.
   * Seeded once with `#000000`, that test cannot tell "rejected" from "parsed to
   * exactly the seed", so it carved out `#000` and `black` by regex and missed
   * `rgb(0, 0, 0)` — the ONLY form `getComputedStyle` returns. Every element with
   * pure black text came back `no-foreground` and left the measurement entirely.
   *
   * Found on /map: Leaflet's zoom controls are `rgb(0, 0, 0)` on `rgb(255, 255, 255)`,
   * 21:1, and were being filed as unmeasurable. The failure mode is the one this
   * whole file exists to prevent — "could not measure" silently standing in for
   * "verified" — so it is pinned here rather than left to the route sweep, which
   * only sees it when a page happens to use black.
   *
   * The second fixture is the negative control. Without it, a fallback that
   * called everything 'measured' would pass the first assertion, and the whole
   * point of this file — that "could not measure" is never rounded to "fine" —
   * would be gone. It uses `background-clip: text` with no gradient behind it,
   * which is the documented `no-foreground` case: the text colour is supposed to
   * come from gradient stops and there are none.
   *
   * NOT a `url()` background, which was tried first and does not work: with a
   * transparent own background the fallback falls through to the ancestor's
   * colour and measures, which is existing behaviour and not this ticket's.
   */
  const BLACK_ID = 'aaa-fallback-black-fixture';
  const UNRESOLVABLE_ID = 'aaa-fallback-noresolve-fixture';

  test('the fallback resolves rgb(0, 0, 0) and still rejects what it cannot read', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForLoadStateOrGiveUp(page, 'load');

    await page.evaluate(
      ([blackId, urlId]) => {
        // Black text on a GRADIENT, because the fallback only ever runs on
        // nodes axe declined to measure, and a gradient is why axe declines.
        // A flat background would be measured by axe and never reach here.
        const black = document.createElement('p');
        black.id = blackId;
        black.textContent = 'black on a gradient';
        black.setAttribute(
          'style',
          'color:rgb(0, 0, 0);font-size:13px;padding:8px;' +
            'background-image:linear-gradient(90deg, #ffffff, #fdfdfd)'
        );
        document.body.appendChild(black);

        // Clipped to text with nothing to clip: the glyphs take their colour
        // from gradient stops, and there is no gradient. Genuinely unreadable.
        const noResolve = document.createElement('p');
        noResolve.id = urlId;
        noResolve.textContent = 'clipped to a gradient that is not there';
        noResolve.setAttribute(
          'style',
          'font-size:13px;padding:8px;background-image:none;' +
            '-webkit-background-clip:text;background-clip:text;' +
            '-webkit-text-fill-color:transparent'
        );
        document.body.appendChild(noResolve);
      },
      [BLACK_ID, UNRESOLVABLE_ID] as const
    );

    const rows = await page.evaluate(measureNullRatioNodes, [
      `#${BLACK_ID}`,
      `#${UNRESOLVABLE_ID}`,
    ]);

    const black = rows.find((r) => r.selector === `#${BLACK_ID}`);
    const noResolve = rows.find((r) => r.selector === `#${UNRESOLVABLE_ID}`);

    expect(black, 'the black fixture was not returned at all').toBeTruthy();
    expect(
      { kind: black!.kind, reason: black!.reason ?? null },
      `black text must be MEASURED. 'no-foreground' here means rgbOf cannot parse ` +
        `rgb(0, 0, 0) again, and every black element on every route is silently ` +
        `dropped from the sweep (#43).`
    ).toEqual({ kind: 'measured', reason: null });
    expect(black!.ratio, 'black on near-white is 21:1').toBeGreaterThan(19);

    // The control: this one genuinely cannot be reduced to a colour, and saying
    // so is the behaviour that makes the assertion above mean something.
    expect(
      { kind: noResolve!.kind, reason: noResolve!.reason ?? null },
      `the fallback must still refuse what it cannot read. If this is 'measured', ` +
        `it resolves a colour for everything and the assertion above is vacuous.`
    ).toEqual({ kind: 'unresolvable', reason: 'no-foreground' });
  });

  /**
   * TEXT ON A BACKGROUND IMAGE IS NOT MEASURABLE, AND MUST SAY SO (#105).
   *
   * The `background-image-url` branch has always carried a comment describing
   * exactly this case — "the image sits on top of it and is unaccounted for" —
   * and was unreachable on the one path that needed it. A `url()` layer yields no
   * gradient stops, which sent it down the "every layer was decoration" recovery,
   * which always found SOMETHING: the element's own background-color, or an
   * ancestor's. So the row came back `measured`, against a surface the image is
   * covering.
   *
   * Both fixtures were observed returning `kind: 'measured'` before the fix —
   * 12.55:1 and 1.26:1 respectively, both meaningless.
   *
   * The first is DaisyUI's `.btn` exactly: `none, url(data:…feTurbulence…)` over
   * an opaque colour. That mattered more than a hypothetical, because
   * `UNRESOLVABLE_ALLOWLIST` already asserts every `.btn` is expected to be
   * unresolvable for this reason — an entry that could never match, quietly
   * describing behaviour the code did not have.
   */
  const BTN_ID = 'aaa-fallback-url-over-colour';
  const ANCESTOR_ID = 'aaa-fallback-url-on-ancestor';

  test('text over a background image is refused, not measured against what is under it', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForLoadStateOrGiveUp(page, 'load');

    await page.evaluate(
      ([btnId, ancestorId]) => {
        // DaisyUI's own noise texture, verbatim from `--fx-noise`. Its only `#`
        // is URL-encoded as `%23a`, so the stop scanner finds no colour in it —
        // which is precisely why the recovery path used to swallow it.
        const NOISE =
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.34' numOctaves='4' stitchTiles='stitch'%3E%3C/feTurbulence%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)' opacity='0.2'%3E%3C/rect%3E%3C/svg%3E\")";

        const btn = document.createElement('p');
        btn.id = btnId;
        btn.textContent = 'an image over an opaque colour';
        btn.setAttribute(
          'style',
          'color:rgb(0,0,0);font-size:13px;padding:8px;' +
            `background-color:rgb(200,200,200);background-image:none,${NOISE}`
        );
        document.body.appendChild(btn);

        // The ancestor case: the element itself has nothing readable, and the
        // walk upward meets an image. Climbing past it reaches rgb(30,30,30) —
        // a colour the image is covering.
        const outer = document.createElement('div');
        outer.setAttribute(
          'style',
          `background-color:rgb(30,30,30);background-image:${NOISE}`
        );
        const inner = document.createElement('p');
        inner.id = ancestorId;
        inner.textContent = 'text over an ancestor image';
        inner.setAttribute(
          'style',
          'color:rgb(0,0,0);font-size:13px;padding:8px;' +
            'background-image:linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0))'
        );
        outer.appendChild(inner);
        document.body.appendChild(outer);
      },
      [BTN_ID, ANCESTOR_ID] as const
    );

    const rows = await page.evaluate(measureNullRatioNodes, [
      `#${BTN_ID}`,
      `#${ANCESTOR_ID}`,
    ]);
    const btn = rows.find((r) => r.selector === `#${BTN_ID}`);
    const ancestor = rows.find((r) => r.selector === `#${ANCESTOR_ID}`);

    expect(
      { kind: btn?.kind, reason: btn?.reason ?? null },
      `a url() layer over an opaque background-color must NOT be measured ` +
        `against that colour. This is DaisyUI's .btn on every route, and ` +
        `UNRESOLVABLE_ALLOWLIST already claims it behaves this way (#105).`
    ).toEqual({ kind: 'unresolvable', reason: 'background-image-url' });

    // The base colour still rides along for triage — refusing to measure is not
    // refusing to help — but it is NOT the measurement.
    expect(btn!.baseColorRatio, 'triage figure is still reported').toBeCloseTo(
      12.55,
      1
    );
    expect(btn!.ratio, 'a refused row carries no ratio').toBeUndefined();

    expect(
      { kind: ancestor?.kind, reason: ancestor?.reason ?? null },
      `the ancestor walk must stop at an image rather than climbing past it to ` +
        `the colour behind it (#105).`
    ).toEqual({ kind: 'unresolvable', reason: 'background-image-url' });

    // NO triage figure here, deliberately: this element's own background is
    // transparent, which parses to black through the canvas and would print a
    // confident 21:1 that means nothing. An absent number beats a misleading one.
    expect(
      ancestor!.baseColorRatio,
      'a transparent own-background must not be reported as a triage colour'
    ).toBeUndefined();
  });
});
