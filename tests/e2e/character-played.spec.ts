import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { waitForLoadStateOrGiveUp } from './utils/settle';
import {
  measureNullRatioNodes,
  VENDOR_EXCLUDED,
} from './utils/contrast-fallback';

/**
 * WCAG AAA on the PLAYED state of /character.
 *
 * WHY THIS SPEC EXISTS AT ALL. `color-contrast.spec.ts` sweeps routes as an
 * anonymous first-time visitor. On /character that is the character-creation
 * form and nothing else — the sheet, the encounter badges, the wild-die chip
 * and the outcome line are all behind a character existing in `localStorage`,
 * so a route sweep can never reach them. A green check there says "the form is
 * clean", which is not what anyone reads it as.
 *
 * WHY IT DOES NOT USE `color-contrast-enhanced`. That rule is INERT in
 * axe-core 4.10.2. Measured here on a bare `<p>` appended to `<body>` at
 * #9a9a9a on #bcbcbc, 13px normal weight — a 1.48:1 ratio:
 *
 *   color-contrast (AA)  -> 1 violation, expectedContrastRatio "4.5:1"
 *   color-contrast-enhanced -> 0 violations, 1 PASS,
 *                              "Element has sufficient color contrast of 1.4817"
 *
 * The AAA rule's `data` carries only `contrastRatio` — no `expectedContrastRatio`,
 * no `fgColor`/`bgColor` — i.e. it measures and then never compares. Forcing
 * `rules: { 'color-contrast-enhanced': { enabled: true } }` changes nothing.
 *
 * So AAA is derived here from the rule that does work: run `color-contrast`,
 * take its measured ratio for EVERY node (passes included — it reports full
 * data on those), and apply the AAA thresholds ourselves. Null-ratio nodes go
 * through the same canvas fallback the route sweep uses (#459), because text
 * over a gradient is most of this UI.
 */
const axeSource = readFileSync(
  require.resolve('axe-core/axe.min.js', {
    paths: [dirname(require.resolve('jest-axe'))],
  }),
  'utf8'
);

interface ContrastData {
  contrastRatio?: number | null;
  fgColor?: string;
  bgColor?: string;
  fontSize?: string;
  fontWeight?: string;
}
interface AxeNode {
  target?: string[];
  html?: string;
  any?: Array<{ data?: ContrastData }>;
}
interface AxeResults {
  violations: Array<{ id: string; nodes: AxeNode[] }>;
  passes?: Array<{ id: string; nodes: AxeNode[] }>;
}

const THEMES = ['geolarp-light', 'geolarp-dark'] as const;

/**
 * A fixed character, so a failure is reproducible rather than a draw that
 * happened to be unlucky. Shape matches `Character` in
 * `src/lib/geolarp/character.ts`.
 */
const CHARACTER = {
  version: 1,
  name: 'Ada Wren',
  attributes: {
    Strength: { dice: 4, pips: 0 },
    Agility: { dice: 3, pips: 0 },
    Intellect: { dice: 3, pips: 0 },
    Spirit: { dice: 3, pips: 0 },
    Luck: { dice: 2, pips: 0 },
  },
  skills: {
    Brawl: { dice: 5, pips: 0 },
    Search: { dice: 4, pips: 1 },
    Stealth: { dice: 4, pips: 2 },
  },
  characterPoints: 5,
  created: '2026-08-26T12:00:00.000Z',
};

/** WCAG AAA: 7:1 normal text, 4.5:1 large text (>=18pt, or >=14pt bold). */
const AAA_NORMAL = 7;
const AAA_LARGE = 4.5;

function requiredRatio(fontSizePt: number, bold: boolean): number {
  const isLarge = fontSizePt >= 18 || (bold && fontSizePt >= 14);
  return isLarge ? AAA_LARGE : AAA_NORMAL;
}

/** axe reports fontSize as e.g. "9.8pt (13px)". */
function parsePt(fontSize: string | undefined): number {
  const m = /([\d.]+)pt/.exec(fontSize ?? '');
  return m ? parseFloat(m[1]) : 12;
}

async function runContrastRule(page: import('@playwright/test').Page) {
  await page.evaluate(axeSource);
  return page.evaluate<AxeResults>(async () => {
    const w = window as unknown as {
      __shAxeRun?: Promise<AxeResults>;
      axe: { run: (d: Document, o: unknown) => Promise<AxeResults> };
    };
    // Playwright retries an evaluate whose context is destroyed; a second
    // axe.run() throws, so the promise is cached.
    w.__shAxeRun ??= w.axe.run(document, {
      runOnly: { type: 'rule', values: ['color-contrast'] },
      // 'passes' is load-bearing twice over: axe files unmeasurable nodes
      // there with a null ratio (#459), AND every node that clears AA but not
      // AAA is a pass under this rule — which is exactly what we are looking
      // for. Omitting a group also truncates it to a single node.
      resultTypes: ['violations', 'incomplete', 'passes'],
    });
    return w.__shAxeRun;
  });
}

/** Everything on this page below the AAA threshold, measured or re-measured. */
async function contrastFailures(page: import('@playwright/test').Page) {
  const results = await runContrastRule(page);

  const allNodes = [...(results.passes ?? []), ...results.violations].flatMap(
    (g) => g.nodes
  );

  const measured = allNodes
    .map((n) => ({ node: n, d: n.any?.[0]?.data }))
    .filter((x) => typeof x.d?.contrastRatio === 'number')
    .map(({ node, d }) => {
      const required = requiredRatio(
        parsePt(d!.fontSize),
        /bold|[7-9]00/.test(String(d!.fontWeight ?? ''))
      );
      return {
        target: node.target?.[0],
        html: node.html?.slice(0, 120),
        fg: d!.fgColor,
        bg: d!.bgColor,
        ratio: d!.contrastRatio,
        required,
        note: 'measured by axe color-contrast, judged against AAA here',
      };
    })
    .filter((r) => (r.ratio as number) < r.required);

  const unmeasured: string[] = allNodes
    .filter((n) => (n.any?.[0]?.data?.contrastRatio ?? null) === null)
    .map((n) => n.target?.[0])
    .filter((t): t is string => typeof t === 'string');

  const fallback = unmeasured.length
    ? await page.evaluate(measureNullRatioNodes, unmeasured)
    : [];

  const fromFallback = fallback
    .filter((r) => r.kind === 'measured' && r.ratio! < r.required!)
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
      required: r.required,
      note: `axe reported a PASS with contrastRatio: null (${r.mode})`,
    }));

  return {
    failures: [...measured, ...fromFallback],
    counts: {
      nodes: allNodes.length,
      nullRatio: unmeasured.length,
      reMeasured: fallback.filter((r) => r.kind === 'measured').length,
    },
  };
}

for (const theme of THEMES) {
  test.describe(`WCAG AAA — /character played (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        ([t, c]) => {
          window.localStorage.setItem('theme', t as string);
          window.localStorage.setItem('geolarp_character', c as string);
        },
        [theme, JSON.stringify(CHARACTER)] as const
      );
      await page.goto('/character/', { waitUntil: 'domcontentloaded' });
      await waitForLoadStateOrGiveUp(page, 'load');
      // Prove we are past the creation form, or everything below measures it.
      await expect(
        page.getByRole('heading', { name: 'Ada Wren', level: 2 })
      ).toBeVisible({ timeout: 15000 });
    });

    test('the sheet and the encounter card are AAA', async ({ page }) => {
      const { failures, counts } = await contrastFailures(page);
      expect(failures, JSON.stringify({ counts, failures }, null, 2)).toEqual(
        []
      );
    });

    test('the roller and its dice are AAA', async ({ page }) => {
      await page
        .getByRole('button', { name: /^Search/ })
        .first()
        .click();
      const roll = page.getByRole('button', { name: 'Roll Search' });
      await expect(roll).toBeVisible();
      await roll.click();
      // The outcome line and the dice chips only exist after a roll.
      await expect(
        page.getByRole('status', { name: 'Roll result' })
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole('list', { name: 'Dice faces, wild die first' })
      ).toBeVisible();

      const { failures, counts } = await contrastFailures(page);
      expect(failures, JSON.stringify({ counts, failures }, null, 2)).toEqual(
        []
      );
    });

    test('the discard confirmation is AAA', async ({ page }) => {
      // A new surface with a colour role nothing else on this page uses:
      // btn-error. It only exists once "New character" is pressed, so the
      // route sweep can never reach it and neither could the tests above.
      await page.getByRole('button', { name: 'New character' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Discard and roll a new one/ })
      ).toBeVisible();

      const { failures, counts } = await contrastFailures(page);
      expect(failures, JSON.stringify({ counts, failures }, null, 2)).toEqual(
        []
      );
    });

    test('the grid-movement controls are AAA', async ({ page }) => {
      await page.getByRole('button', { name: 'Grid movement' }).click();
      await expect(
        page.getByRole('group', { name: 'Move one cell' })
      ).toBeVisible();
      const { failures, counts } = await contrastFailures(page);
      expect(failures, JSON.stringify({ counts, failures }, null, 2)).toEqual(
        []
      );
    });
  });
}

/**
 * Horizontal overflow in the PLAYED state.
 *
 * `mobile-horizontal-scroll.spec.ts` sweeps /character too, and passes — but
 * like the contrast sweep it only ever sees the creation form, which is one
 * centred card. The sheet is a two-column grid of five sections carrying
 * monospace dice codes, and the encounter footer prints a seed string that
 * cannot wrap at a space. Those are the parts that can actually overflow, and
 * nothing was looking at them.
 */
test.describe('/character played — no horizontal overflow', () => {
  const WIDTHS = [320, 375, 390, 428];

  for (const width of WIDTHS) {
    test(`fits at ${width}px`, async ({ page }) => {
      await page.addInitScript(
        ([t, c]) => {
          window.localStorage.setItem('theme', t as string);
          window.localStorage.setItem('geolarp_character', c as string);
        },
        ['geolarp-light', JSON.stringify(CHARACTER)] as const
      );
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/character/', { waitUntil: 'domcontentloaded' });
      await waitForLoadStateOrGiveUp(page, 'load');
      await expect(
        page.getByRole('heading', { name: 'Ada Wren', level: 2 })
      ).toBeVisible({ timeout: 15000 });

      // Open the roller too — the dice row is the widest thing on the page.
      await page
        .getByRole('button', { name: /^Search/ })
        .first()
        .click();
      const roll = page.getByRole('button', { name: 'Roll Search' });
      await expect(roll).toBeVisible();
      await roll.click();
      await expect(
        page.getByRole('status', { name: 'Roll result' })
      ).toBeVisible({ timeout: 15000 });

      // MEASURE THIS PAGE'S OWN CONTENT, not the document.
      //
      // `src/app/layout.tsx` clips the x axis, so `documentElement.scrollWidth`
      // is pinned to `clientWidth` by construction and can never report
      // anything — `mobile-horizontal-scroll.spec.ts` says exactly that at its
      // top, and carries a whole ancestor-clip excuse system to work around it.
      // Duplicating that here would only re-derive it badly: a first draft did,
      // and what it "caught" was SetupBanner's dismiss button, an app-shell
      // alert that appears solely because a local .env has placeholder Supabase
      // values. That is a misconfigured environment, not this page.
      //
      // So this asserts the narrower thing this spec actually owns: nothing
      // rendered inside <main> sticks out of <main>.
      const overflow = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return { limit: 0, worst: 0, offenders: ['no <main>'] };
        const limit = main.getBoundingClientRect().right;
        const offenders: string[] = [];
        let worst = limit;
        main.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0) return;
          if (r.right > limit + 1) {
            worst = Math.max(worst, r.right);
            offenders.push(
              `${el.tagName.toLowerCase()}.${(el.className || '')
                .toString()
                .split(' ')
                .slice(0, 3)
                .join('.')} right=${Math.round(r.right)} > ${Math.round(limit)}`
            );
          }
        });
        return {
          limit: Math.round(limit),
          worst: Math.round(worst),
          offenders: offenders.slice(0, 8),
        };
      });

      expect(overflow.offenders, JSON.stringify(overflow, null, 2)).toEqual([]);
    });
  }
});
