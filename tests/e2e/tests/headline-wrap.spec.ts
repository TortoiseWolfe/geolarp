import { test, expect, Page } from '@playwright/test';

/**
 * HEADLINE RULE: no single word alone on a line in any headline or display
 * text (Jonathan's rule for the geoLARP front pages).
 *
 * This measures the RENDERED wrap rather than reading the source, because the
 * source cannot say where a browser breaks a line: that depends on the width,
 * the font that actually loaded and `text-wrap: balance`. Each word gets its
 * own Range, the Range rectangles are grouped into lines by their top edge,
 * and a heading that renders a line holding exactly one word fails.
 *
 * A heading of a single word has no wrap to judge and is skipped. The check
 * can fail: the last test feeds it a heading it must reject.
 */
const WIDTHS = [320, 390, 768, 1280];
const PAGES = ['/', '/play/'];

async function lonelyLines(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const headings = document.querySelectorAll<HTMLElement>(
      'main h1, main h2, main h3, main [data-display]'
    );
    for (const el of headings) {
      if (!el.offsetParent) continue; // not rendered
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const words: { text: string; top: number }[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const data = (n as Text).data;
        for (const m of data.matchAll(/\S+/g)) {
          const r = document.createRange();
          r.setStart(n, m.index!);
          r.setEnd(n, m.index! + m[0].length);
          const rect = r.getBoundingClientRect();
          words.push({ text: m[0], top: Math.round(rect.top) });
        }
      }
      if (words.length < 2) continue;
      const lines: string[][] = [];
      let last = Number.NaN;
      for (const w of words) {
        if (Number.isNaN(last) || Math.abs(w.top - last) > 4) {
          lines.push([]);
          last = w.top;
        }
        lines[lines.length - 1].push(w.text);
      }
      for (const l of lines) {
        if (l.length === 1 && lines.length > 1) {
          out.push(`"${l[0]}" alone in: ${el.textContent?.trim()}`);
        }
      }
    }
    return out;
  });
}

test.describe('headlines never leave one word alone on a line', () => {
  for (const path of PAGES) {
    for (const width of WIDTHS) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.locator('main h1').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        expect(await lonelyLines(page)).toEqual([]);
      });
    }
  }

  test('the check can fail (a heading that strands a word is reported)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      const h = document.createElement('h2');
      h.id = 'probe';
      h.style.cssText = 'width:120px;font-size:24px;margin:0';
      h.textContent = 'Wonderful extraordinarily';
      document.querySelector('main')!.prepend(h);
    });
    const found = await lonelyLines(page);
    expect(found.some((f) => f.includes('Wonderful extraordinarily'))).toBe(
      true
    );
  });
});
