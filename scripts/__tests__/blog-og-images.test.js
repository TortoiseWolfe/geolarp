/**
 * Every published post must ship BOTH images, and both must exist (#655).
 *
 * TWO DIFFERENT IMAGES, AND CONFUSING THEM IS THE BUG THIS FILE WAS WRITTEN WITH.
 *
 *   `ogImage`       -> the social card. Only ever seen when someone pastes the link.
 *   `featuredImage` -> the image ON the site: BlogPostCard in the listing, and
 *                      BlogPostViewer on the post itself.
 *
 * The first version of this gate checked `ogImage` alone. `storefront-that-cannot-
 * take-money.md` was then "fixed" by adding `ogImage`, the gate went green, and the
 * post went on rendering with no image anywhere a reader would look — which is what
 * "the blog still doesn't have images" meant when it was reported. A gate pointed at
 * the field nobody sees, certifying the field everybody sees.
 *
 * `scripts/generate-blog-data.js` keeps them apart deliberately: `ogImage` lands at
 * `seo.ogImage` (:122) and `featuredImage` at `metadata.featuredImage` (:113), and
 * only the latter is read by the components. `ogImage` falls back to `featuredImage`
 * but NOT the other way round, so declaring only `ogImage` yields a post with a share
 * card and a blank page.
 *
 * Both are asserted, and both are checked for existence on disk, because a frontmatter
 * field pointing at a missing file is exactly as broken as no field — and it is the
 * likelier mistake once the field is mandatory.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const BLOG_DIR = path.join(__dirname, '..', '..', 'public', 'blog');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

/**
 * Empty on purpose. This held `bad-seo-example.md`, a deliberate bad-SEO demo that was
 * one of the template's own posts and was removed when the fork stopped republishing
 * them. The mechanism stays: exempt by name WITH the reason, never by loosening the
 * rule for everyone — and the test below fails if an exemption outlives its file.
 */
const INTENTIONALLY_IMAGELESS = new Set([]);

// CLAUDE.md in public/blog is guidance for authors, not a post.
const all = fs
  .readdirSync(BLOG_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md');
const posts = all.filter((f) => !INTENTIONALLY_IMAGELESS.has(f));

const frontmatter = (file) => {
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
};

const field = (fm, name) => {
  const m = fm.match(new RegExp(`^${name}:\\s*(\\S+)`, 'm'));
  return m ? m[1] : null;
};

describe('every blog post ships with images a reader can actually see', () => {
  it('finds posts to check at all', () => {
    // A glob that silently matches nothing would make every assertion below vacuous.
    //
    // This used to assert `>= 10`. That number was standing in for "the glob still
    // works", but it is really a claim about how much content the blog has — so it
    // went stale the moment the corpus was deliberately cut to three, and it would
    // have been silently meaningless at 300. Cross-check the INDEPENDENT source
    // instead: the committed index. It cannot pass vacuously (an empty disk and a
    // non-empty index disagree) and it does not care how many posts exist.
    const indexed = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          '..',
          '..',
          'src',
          'lib',
          'blog',
          'blog-data.json'
        ),
        'utf8'
      )
    ).posts;
    assert.ok(all.length > 0, `no posts found in ${BLOG_DIR}`);
    assert.strictEqual(
      all.length,
      indexed.length,
      `public/blog has ${all.length} posts but blog-data.json has ${indexed.length} — ` +
        'run `pnpm generate:blog`. See blog-index-matches-disk.test.js.'
    );
  });

  it('the exemption list still matches real files', () => {
    // An exemption for a file that no longer exists is a rule quietly not applying to
    // anything. If the demo post is renamed, this fails instead of going stale.
    const missing = [...INTENTIONALLY_IMAGELESS].filter(
      (f) => !all.includes(f)
    );
    assert.deepStrictEqual(
      missing,
      [],
      `exempted but not present: ${missing.join(', ')} — remove the exemption or fix the name`
    );
  });

  for (const file of posts) {
    for (const name of ['featuredImage', 'ogImage']) {
      it(`${file} declares ${name}`, () => {
        const value = field(frontmatter(file), name);
        assert.ok(
          value,
          `${file} has no ${name}.\n` +
            (name === 'featuredImage'
              ? '  featuredImage is the one a READER sees — the blog card and the post ' +
                'page both render it. Without it the post is blank on the site even ' +
                'if ogImage is set.'
              : '  ogImage is the social card, shown when the link is pasted.') +
            `\n  Put the file in public/blog-images/<slug>/featured-og.png and point ` +
            `${name} at it.`
        );
      });

      it(`${file}'s ${name} file exists on disk`, () => {
        const value = field(frontmatter(file), name);
        if (!value) return; // reported by the assertion above
        const rel = value.replace(/^\/+/, '');
        assert.ok(
          fs.existsSync(path.join(PUBLIC_DIR, rel)),
          `${file} points ${name} at public/${rel}, which does not exist`
        );
      });
    }
  }
});
