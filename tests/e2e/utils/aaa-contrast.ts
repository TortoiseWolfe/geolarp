/**
 * WCAG AAA contrast, derived from the rule that works (#43).
 *
 * `color-contrast-enhanced` — the AAA rule — is INERT in axe-core 4.10.2. It
 * measures a ratio and never compares it to a threshold. Measured on a bare `<p>`
 * at #9a9a9a on #bcbcbc, 13px normal, which is 1.48:1 against a 7:1 requirement:
 *
 *   color-contrast (AA)      -> 1 violation, expectedContrastRatio "4.5:1"
 *   color-contrast-enhanced  -> 0 violations, 1 PASS,
 *                               "Element has sufficient color contrast of 1.4817"
 *
 * The AAA rule's `data` carries only `contrastRatio` — no `expectedContrastRatio`,
 * no `fgColor`, no `bgColor`. Forcing it on with `rules: {...enabled: true}`
 * changes nothing. So any spec asserting on ITS violations asserts on a path that
 * cannot produce one, and reports large `passes` counts that read as coverage.
 *
 * `color-contrast` (AA) is correct AND returns full data on passes as well as
 * violations. So AAA is derived here: take the measured ratio for every node and
 * apply the thresholds locally.
 *
 * Extracted from `character-played.spec.ts`, which already did this and is
 * verified against a deliberately injected 1.48:1 element. One copy, because two
 * specs disagreeing about what AAA means is its own defect.
 */

/** WCAG AAA: 7:1 normal text, 4.5:1 large text (>=18pt, or >=14pt bold). */
export const AAA_NORMAL = 7;
export const AAA_LARGE = 4.5;

export interface ContrastData {
  contrastRatio?: number | null;
  fgColor?: string;
  bgColor?: string;
  fontSize?: string;
  fontWeight?: string;
}

export interface AxeContrastNode {
  target?: string[];
  html?: string;
  any?: Array<{ data?: ContrastData }>;
}

export interface AaaFailure {
  target?: string;
  html?: string;
  fg?: string;
  bg?: string;
  ratio?: number | null;
  expected: number;
  note: string;
}

/**
 * A contrast ratio axe actually resolved.
 *
 * **1:1 is the mathematical floor** — it is the ratio of a colour against itself.
 * Nothing can be below it. So a reported `0` is not terrible contrast, it is a
 * SENTINEL for "could not compute", and axe emits it with `fgColor`/`bgColor`
 * absent.
 *
 * MEASURED, because a naive `typeof === 'number'` filter looks correct and is not.
 * A full 49-path sweep flagged 2,992 nodes; **2,959 of them carried ratio 0** and
 * only 54 a real ratio (36 at 2.13:1, 18 at 1.3:1). Judging the zeros as failures
 * reports every route in both themes as broken and buries the handful that are.
 *
 * Zeros belong in the #459 unmeasured bucket with the nulls — a question axe never
 * answered, routed to the canvas fallback — not in the failure list.
 */
export function isMeasuredRatio(r: number | null | undefined): r is number {
  return typeof r === 'number' && r >= 1;
}

export function requiredRatio(fontSizePt: number, bold: boolean): number {
  const isLarge = fontSizePt >= 18 || (bold && fontSizePt >= 14);
  return isLarge ? AAA_LARGE : AAA_NORMAL;
}

/** axe reports fontSize as e.g. "9.8pt (13px)". */
export function parsePt(fontSize: string | undefined): number {
  const m = /([\d.]+)pt/.exec(fontSize ?? '');
  return m ? parseFloat(m[1]) : 12;
}

export function isBold(fontWeight: string | undefined): boolean {
  return /bold|[7-9]00/.test(String(fontWeight ?? ''));
}

/**
 * Every node axe measured that falls below its AAA requirement.
 *
 * Takes BOTH passes and violations on purpose: a node that clears AA but not AAA
 * is a `color-contrast` PASS, and that is exactly the population this gate is for.
 * Nodes with a null ratio are not judged here — axe could not measure them, and
 * they go to the canvas fallback instead (#459).
 */
export function aaaFailures(nodes: AxeContrastNode[]): AaaFailure[] {
  return nodes
    .map((node) => ({ node, d: node.any?.[0]?.data }))
    .filter((x) => isMeasuredRatio(x.d?.contrastRatio))
    .map(({ node, d }) => ({
      target: node.target?.[0],
      html: node.html?.slice(0, 120),
      fg: d!.fgColor,
      bg: d!.bgColor,
      ratio: d!.contrastRatio,
      expected: requiredRatio(parsePt(d!.fontSize), isBold(d!.fontWeight)),
      note: 'measured by axe color-contrast, judged against AAA here',
    }))
    .filter((r) => (r.ratio as number) < r.expected);
}
