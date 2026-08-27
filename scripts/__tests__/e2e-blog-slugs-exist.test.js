/**
 * Every literal `/blog/<slug>` in the E2E suite must name a post that exists (#45).
 *
 * WHY THIS IS NOT ALREADY COVERED. `e2e-gotos-resolve.test.js` checks literal paths
 * against the ROUTE table, and `/blog/[slug]` is a real route — so
 * `/blog/countdown-timer-tutorial` passed that check while naming a post this repo
 * does not have. Route-level resolution cannot see content-level absence. That is
 * exactly the hole #45 fell through.
 *
 * WHAT IT COST. The rebrand replaced the blog wholesale and left two ScriptHammer
 * slugs in `blog-mobile-ux-iphone.spec.ts` and `blog-markdown-rendering.spec.ts`.
 * Both navigated to the error page, so four tests failed on every browser and three
 * more passed having asserted nothing — their assertions sat inside `if (count > 0)`
 * guards against elements the error page never renders. `E2E (local) result` is a
 * REQUIRED check and was red on `main` from 2026-08-22, unnoticed because every
 * merge in between was docs-only: those skip the shards, and the aggregate then
 * reports green. Four days of a red required gate reading as green.
 *
 * WHAT THIS CANNOT CHECK, so a green run is not over-read: computed slugs. The
 * specs now derive theirs from `blogCorpus()`, which reads the same directory, so
 * they cannot drift — but a future `goto(`/blog/${someOtherSource}`)` is invisible
 * here, the same limitation `e2e-gotos-resolve.test.js` records for routes.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const BLOG_DIR = path.join(ROOT, 'public', 'blog');
const E2E_DIR = path.join(ROOT, 'tests', 'e2e');
const BLOG_ROUTES_DIR = path.join(ROOT, 'src', 'app', 'blog');

/**
 * Sub-routes under /blog that are pages, not posts — `/blog/tags`, `/blog/seo`.
 * They are real routes and must not be reported as missing posts. Read from
 * disk for the same reason the corpus is: a hardcoded pair would go stale the
 * moment someone adds a third.
 */
function reservedSubRoutes() {
  return new Set(
    fs
      .readdirSync(BLOG_ROUTES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('['))
      .map((e) => e.name)
  );
}

/** `CLAUDE.md` in that directory is authoring guidance, not a post. */
function publishedSlugs() {
  return new Set(
    fs
      .readdirSync(BLOG_DIR)
      .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md')
      .map((f) => f.replace(/\.md$/, ''))
  );
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Literal `/blog/<slug>` only. A `${...}` in the path makes it computed. */
function literalBlogRefs() {
  const found = [];
  for (const file of walk(E2E_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(
        /['"`]\/blog\/([a-z0-9][a-z0-9-]*)['"`/]/g
      )) {
        found.push({
          file: path.relative(ROOT, file),
          line: i + 1,
          slug: m[1],
        });
      }
    });
  }
  return found;
}

test('the blog corpus is not empty', () => {
  assert.ok(
    publishedSlugs().size > 0,
    `no posts found in ${path.relative(ROOT, BLOG_DIR)}`
  );
});

test('every literal /blog/<slug> in tests/e2e names a post that exists', () => {
  const slugs = publishedSlugs();
  const reserved = reservedSubRoutes();
  const refs = literalBlogRefs();
  const missing = refs.filter(
    (r) => !slugs.has(r.slug) && !reserved.has(r.slug)
  );

  assert.deepStrictEqual(
    missing.map((r) => `${r.file}:${r.line} -> /blog/${r.slug}`),
    [],
    'These specs navigate to blog posts that do not exist. In a static export ' +
      'that serves the error page, so the test measures the 404 instead of its ' +
      `subject. Posts available: ${[...slugs].sort().join(', ')}. ` +
      `Reserved sub-routes: ${[...reserved].sort().join(', ') || '(none)'}`
  );
});

test('the detector would notice a slug that is not published', () => {
  // A gate nobody has seen fail is a gate nobody knows works (#45 was found
  // because a check that could not fail had been reporting green).
  const slugs = publishedSlugs();
  assert.ok(
    !slugs.has('countdown-timer-tutorial'),
    'countdown-timer-tutorial is the ScriptHammer post this test exists for; ' +
      'if it now exists here, pick another absent slug for this control'
  );
});
