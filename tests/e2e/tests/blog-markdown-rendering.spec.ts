import { expect, test, type Locator, type Page } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';
import {
  blogCorpus,
  postsWithCode,
  postsWithTables,
  type BlogPost,
} from '../utils/blog-corpus';

const WIDTHS = [390, 500] as const;
const VIEWPORT_HEIGHT = 900;
const BLOG_CONTENT = 'article.blog-post-viewer > article';
const TABLE_SCROLLER = '[data-blog-table-scroll]';

/**
 * FIXTURES ARE DERIVED FROM THE POSTS THAT EXIST, NOT HARDCODED (#45).
 *
 * This file used to name two ScriptHammer posts and their exact contents —
 * table headers, row counts, `firstQuote: 'A fixup commit on their branch'`, a
 * bash block containing `--name CountdownBanner`. The rebrand replaced the blog
 * and none of it survived, so the tests navigated to routes that do not exist,
 * got the error page, and failed on every browser for four days while the
 * required check read green behind docs-only merges.
 *
 * A hardcoded list cannot notice its subject is gone. `blogCorpus()` reads
 * `public/blog/*.md`, so the expectations come from the markdown source and the
 * assertion is the one worth making: the renderer reproduces what was authored.
 * Same lesson as #411 — enumerate, never keep a list.
 */
type OverflowMeasurement = {
  document: {
    bodyClientWidth: number;
    bodyScrollWidth: number;
    htmlClientWidth: number;
    htmlScrollWidth: number;
  };
  offenders: string[];
};

/**
 * Find content whose box leaves the viewport without a reachable horizontal
 * scroller. The app shell clips the x axis, so document.scrollWidth alone can
 * stay equal to clientWidth while content is cut off. `hidden` and `clip` are
 * deliberately not excuses: they make the overflowing content unreachable.
 */
async function measureUncontainedOverflow(
  content: Locator,
  viewportWidth: number
): Promise<OverflowMeasurement> {
  return content.evaluate((root, width) => {
    const reachableOverflow = new Set(['auto', 'scroll']);
    const offenders: string[] = [];
    const elements = [root, ...Array.from(root.querySelectorAll('*'))];

    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.left >= -1 && rect.right <= width + 1) continue;

      let hasReachableScroller = false;
      for (
        let ancestor = element.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if (
          reachableOverflow.has(overflowX) &&
          ancestor.scrollWidth > ancestor.clientWidth + 1
        ) {
          hasReachableScroller = true;
          break;
        }
        if (ancestor === root) break;
      }

      if (!hasReachableScroller) {
        const className =
          typeof (element as HTMLElement).className === 'string'
            ? (element as HTMLElement).className.slice(0, 60)
            : '';
        offenders.push(
          `${element.tagName}.${className} left=${Math.round(rect.left)} ` +
            `right=${Math.round(rect.right)} width=${Math.round(rect.width)}`
        );
      }
    }

    const html = document.documentElement;
    return {
      offenders,
      document: {
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        htmlClientWidth: html.clientWidth,
        htmlScrollWidth: html.scrollWidth,
      },
    };
  }, viewportWidth);
}

async function installClipboardCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const captureWindow = window as typeof window & {
      __blogCopiedText?: string;
    };
    const clipboard = {
      writeText(text: string) {
        captureWindow.__blogCopiedText = text;
        return Promise.resolve();
      },
    };

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: clipboard,
      });
    } catch {
      // Some engines expose clipboard on Navigator.prototype instead.
      try {
        Object.defineProperty(Object.getPrototypeOf(navigator), 'clipboard', {
          configurable: true,
          get: () => clipboard,
        });
      } catch {
        // The copy assertion below will fail loudly if neither surface can be
        // instrumented; do not skip it based on browser capability.
      }
    }
  });
}

async function openPost(page: Page, slug: string): Promise<Locator> {
  await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  const content = page.locator(BLOG_CONTENT);
  await expect(content).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.scrollPaddingTop)
    )
    .toBe('90px');
  return content;
}

async function assertTableAndQuoteRendering(
  page: Page,
  viewportWidth: number,
  post: BlogPost
): Promise<Locator> {
  const content = await openPost(page, post.slug);
  const scroller = content.locator(TABLE_SCROLLER);
  await expect(scroller).toHaveCount(post.tables.length);
  await expect(scroller.first()).toHaveAttribute('tabindex', '0');

  for (const [index, expected] of post.tables.entries()) {
    const wrapper = scroller.nth(index);
    const table = wrapper.getByRole('table');
    await expect(table).toHaveCount(1);
    // The source is the expectation: these headers and this row count are what
    // the markdown declares, so a renderer that drops or reorders a column
    // fails here rather than agreeing with itself.
    await expect(table.getByRole('columnheader')).toHaveText(expected.headers);
    await expect(table.getByRole('row')).toHaveCount(expected.dataRows + 1);
  }

  const quotes = content.locator('blockquote');
  await expect(quotes).toHaveCount(post.blockquotes.length);
  if (post.blockquotes.length > 0) {
    // Compare on a prefix: the renderer collapses whitespace and the source
    // does not, so full equality would fail on formatting rather than content.
    await expect(quotes.first()).toContainText(
      post.blockquotes[0].slice(0, 40)
    );
  }

  const layout = await scroller.first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const tableElement = element.querySelector('table');
    return {
      clientWidth: element.clientWidth,
      left: rect.left,
      overflowX: getComputedStyle(element).overflowX,
      right: rect.right,
      scrollWidth: element.scrollWidth,
      tableOverflowX: tableElement
        ? getComputedStyle(tableElement).overflowX
        : null,
    };
  });

  expect(
    ['auto', 'scroll'],
    `${post.slug}: table wrapper must expose overflow`
  ).toContain(layout.overflowX);
  expect(
    ['auto', 'scroll'],
    `${post.slug}: the wrapper, not the semantic table, owns scrolling`
  ).not.toContain(layout.tableOverflowX);
  expect(
    layout.left,
    `${post.slug}: table wrapper crosses left edge`
  ).toBeGreaterThanOrEqual(-1);
  expect(
    layout.right,
    `${post.slug}: table wrapper crosses right edge at ${viewportWidth}px`
  ).toBeLessThanOrEqual(viewportWidth + 1);

  // WHETHER THE TABLE OVERFLOWS IS A PROPERTY OF THE CONTENT, NOT A SETTING.
  // The old fixtures carried `mustScroll: true` for a ScriptHammer post whose
  // table was wide enough to need it. No post here is: the one table measures
  // 356px inside a 356px wrapper at 390px. So the keyboard-reachability check
  // runs when there is a scroll range and is skipped, loudly, when there is
  // not — rather than asserting a range that cannot exist.
  if (layout.scrollWidth > layout.clientWidth + 1) {
    await scroller.first().evaluate((element) => {
      element.scrollLeft = 0;
    });
    await scroller.first().focus();
    await expect(scroller.first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => scroller.first().evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
  } else {
    console.log(
      `[blog-markdown] ${post.slug} @ ${viewportWidth}px: table fits ` +
        `(${layout.scrollWidth}px in ${layout.clientWidth}px), so the ` +
        `keyboard-scroll path is NOT exercised by published content. ` +
        `BlogContent.test.tsx covers keyboard scrolling with a fixture.`
    );
  }

  const overflow = await measureUncontainedOverflow(content, viewportWidth);
  expect(
    overflow.offenders,
    `${post.slug} has clipped or page-level overflow at ${viewportWidth}px:\n` +
      overflow.offenders.join('\n')
  ).toEqual([]);

  // Secondary signals only. The geometry assertion above remains load-bearing
  // because the app shell currently clips the document's x axis.
  expect(overflow.document.bodyScrollWidth).toBeLessThanOrEqual(
    overflow.document.bodyClientWidth + 1
  );
  expect(overflow.document.htmlScrollWidth).toBeLessThanOrEqual(
    overflow.document.htmlClientWidth + 1
  );

  return content;
}

async function assertExistingBlogBehaviors(
  page: Page,
  content: Locator
): Promise<void> {
  const viewer = page.locator('article.blog-post-viewer');

  // The page template owns the only h1. A body h1 is conditionally demoted, as
  // are its child headings, without changing the established slug algorithm.
  await expect(viewer.locator('h1')).toHaveCount(1);

  // ANCHORS AND THE TOC ARE READ OFF THE PAGE, NOT NAMED.
  // The old version asserted a ScriptHammer heading by title and an anchor id
  // by hand. Both were rebrand-fragile for no gain: the claim worth testing is
  // that every heading gets an id and the TOC links to it, which holds for any
  // post and keeps holding when the posts change.
  const anchored = content.locator('h2[id], h3[id]');
  const anchoredCount = await anchored.count();
  expect(
    anchoredCount,
    'no heading carried an id, so anchors and the TOC cannot work'
  ).toBeGreaterThan(0);

  const targetId = await anchored.last().getAttribute('id');
  expect(
    targetId,
    'a heading matched h2[id]/h3[id] but had no id'
  ).toBeTruthy();
  await expect(anchored.last()).not.toBeEmpty();

  const tocDetails = viewer
    .locator('details')
    .filter({ hasText: 'TOC' })
    .first();
  const tocSummary = tocDetails.locator('summary');
  await expect(tocSummary).toBeVisible();
  await tocSummary.click();

  const tocLink = tocDetails.locator(`a[href="#${targetId}"]`);
  await expect(
    tocLink,
    `the TOC has no entry for #${targetId}, which is a real heading on the page`
  ).toBeVisible();
  await tocLink.click();
  await expect
    .poll(() =>
      tocLink.evaluate((element) => {
        const weight = getComputedStyle(element).fontWeight;
        return weight === 'bold' ? 700 : Number.parseInt(weight, 10);
      })
    )
    .toBeGreaterThanOrEqual(700);

  // External links open safely. Which link it is does not matter; that every
  // off-site link carries the rel pair does.
  const externalLinks = content.locator('a[href^="http"][target="_blank"]');
  const externalCount = await externalLinks.count();
  expect(
    externalCount,
    'no external links on this post, so the rel/target contract is unmeasured'
  ).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(externalCount, 5); i += 1) {
    const link = externalLinks.nth(i);
    await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    await expect(link).toHaveAttribute('rel', /\bnoreferrer\b/);
  }
}

/**
 * Prism highlighting and copy-to-clipboard, for posts that have code.
 *
 * Generated per post rather than guarded by an `if` inside a test. No geoLARP
 * post contains a fenced code block today, so this produces NO tests — which is
 * the point. The previous shape was `if (count > 0) { ...every assertion... }`
 * inside a test that therefore passed having measured nothing, and the #861
 * gate caught exactly that. A test that does not exist cannot report a false
 * pass; `BlogContent.test.tsx` covers the renderer with a fixture instead.
 */
async function assertCodePanel(page: Page, post: BlogPost): Promise<void> {
  const content = await openPost(page, post.slug);
  const firstCodePanel = content.locator('.mockup-code').first();
  await expect(firstCodePanel).toBeVisible();

  const expected = post.codeBlocks[0];
  const code = firstCodePanel.locator(`code.language-${expected.lang}`);
  await expect(code).toContainText(expected.firstLine.slice(0, 30));

  const copyButton = firstCodePanel.getByRole('button', { name: 'Copy code' });
  await expect(copyButton).toHaveAttribute('title', 'Copy code');
  await copyButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __blogCopiedText?: string })
            .__blogCopiedText ?? ''
      )
    )
    .toContain(expected.firstLine.slice(0, 20));
}

/**
 * Say out loud what the published corpus can and cannot exercise.
 *
 * Absent coverage should be visible, not inferred from tests that quietly do
 * not exist. This test asserts the corpus is real and prints the capabilities
 * no post exercises; when a post gains a code block or a wide table, the
 * matching tests start generating on their own.
 */
test('the blog corpus is real, and its coverage gaps are named', () => {
  const posts = blogCorpus();
  expect(posts.length, 'no blog posts found on disk').toBeGreaterThan(0);

  const withTables = postsWithTables();
  expect(
    withTables.length,
    'no post has a markdown table, so table rendering is unmeasured here'
  ).toBeGreaterThan(0);

  const withCode = postsWithCode();
  if (withCode.length === 0) {
    console.log(
      `[blog-markdown] ${posts.length} post(s); NONE contain a fenced code ` +
        `block, so Prism highlighting and copy-to-clipboard are not exercised ` +
        `by published content. Covered by BlogContent.test.tsx: 'processes code blocks and adds copy buttons'.`
    );
  }
  console.log(
    `[blog-markdown] tables: ${withTables.map((p) => p.slug).join(', ')}`
  );
});

test.describe('Blog markdown rendering', () => {
  for (const width of WIDTHS) {
    test(`${width}px preserves semantic rich content and existing behavior`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await installClipboardCapture(page);

      for (const post of postsWithTables()) {
        await test.step(`${post.slug}: tables, quotes, and overflow`, async () => {
          await assertTableAndQuoteRendering(page, width, post);
        });
      }

      // The compatibility checks continue against the page already in view,
      // which is the last table post.
      const compatibilityContent = page.locator(BLOG_CONTENT);
      await expect(compatibilityContent).toBeVisible();
      await test.step('anchors, TOC, and external links', async () => {
        await assertExistingBlogBehaviors(page, compatibilityContent);
      });

      for (const post of postsWithCode()) {
        await test.step(`${post.slug}: Prism and copy`, async () => {
          await assertCodePanel(page, post);
        });
      }
    });
  }
});
