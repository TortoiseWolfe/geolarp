/**
 * What the published blog actually contains, read from disk at collection time.
 *
 * WHY THIS EXISTS. The blog E2E specs used to hardcode ScriptHammer's posts and
 * their exact contents — table headers, row counts, quote counts, a bash block
 * containing `--name CountdownBanner`. None of those posts survived the rebrand,
 * so four tests navigated to routes that do not exist, got the error page, and
 * failed on every browser for four days (#45). Three more "passed" having
 * asserted nothing, because their assertions sat inside `if (count > 0)` guards
 * against elements the error page never rendered.
 *
 * A hardcoded list cannot notice that its subject is gone. Enumerating the
 * corpus is the same lesson `color-contrast.spec.ts` learned in #411: derive the
 * expectations from what is really there, and the gate follows the content.
 *
 * The expectations here come from the MARKDOWN SOURCE, deliberately. Comparing
 * rendered output against the source is the actual claim — that the renderer
 * reproduces what was authored. Reading both from the DOM would assert only
 * that the page equals itself.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BLOG_DIR = join(dirname(dirname(dirname(__dirname))), 'public', 'blog');

export interface BlogTable {
  /** Column headers, with markdown emphasis stripped as the renderer strips it. */
  headers: string[];
  /** Body rows, excluding the header and the `|---|` separator. */
  dataRows: number;
}

export interface BlogCodeBlock {
  lang: string;
  firstLine: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  tables: BlogTable[];
  /** One entry per blockquote ELEMENT — consecutive `>` lines are one quote. */
  blockquotes: string[];
  codeBlocks: BlogCodeBlock[];
  hasFeaturedImage: boolean;
  headingCount: number;
  bodyLength: number;
}

function stripInline(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]*\)/g, '$1')
    .trim();
}

function parse(slug: string, raw: string): BlogPost {
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const front = fm ? fm[1] : '';
  const body = fm ? raw.slice(fm[0].length) : raw;

  // Fenced code must come out first, or a fence containing `|` or `>` would be
  // parsed as a table or a quote.
  const codeBlocks: BlogCodeBlock[] = [];
  const withoutCode = body.replace(
    /^```(\w*)\n([\s\S]*?)^```/gm,
    (_m, lang: string, inner: string) => {
      codeBlocks.push({
        lang: lang || 'text',
        firstLine: inner.split('\n')[0]?.trim() ?? '',
      });
      return '\n';
    }
  );

  const tables: BlogTable[] = [];
  for (const block of withoutCode.match(/(?:^\|.*\n?)+/gm) ?? []) {
    const lines = block.trim().split('\n');
    if (lines.length < 2 || !/^\|[\s:|-]+\|$/.test(lines[1].trim())) continue;
    tables.push({
      headers: lines[0]
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(stripInline),
      dataRows: lines.length - 2,
    });
  }

  const blockquotes: string[] = [];
  let current: string[] = [];
  for (const line of withoutCode.split('\n')) {
    if (/^>/.test(line)) {
      current.push(line.replace(/^>\s?/, ''));
    } else if (current.length) {
      blockquotes.push(stripInline(current.join(' ')));
      current = [];
    }
  }
  if (current.length) blockquotes.push(stripInline(current.join(' ')));

  return {
    slug,
    title: /^title:\s*['"]?(.+?)['"]?\s*$/m.exec(front)?.[1] ?? slug,
    tables,
    blockquotes,
    codeBlocks,
    hasFeaturedImage: /^featuredImage:\s*\S/m.test(front),
    headingCount: (withoutCode.match(/^#{2,3}\s/gm) ?? []).length,
    bodyLength: withoutCode.length,
  };
}

let cache: BlogPost[] | null = null;

/** Every published post, slug-sorted. `CLAUDE.md` is authoring guidance, not a post. */
export function blogCorpus(): BlogPost[] {
  if (cache) return cache;
  cache = readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'CLAUDE.md')
    .sort()
    .map((f) =>
      parse(f.replace(/\.md$/, ''), readFileSync(join(BLOG_DIR, f), 'utf8'))
    );
  if (cache.length === 0) {
    throw new Error(`no blog posts found in ${BLOG_DIR}`);
  }
  return cache;
}

export const postsWithTables = () =>
  blogCorpus().filter((p) => p.tables.length > 0);
export const postsWithCode = () =>
  blogCorpus().filter((p) => p.codeBlocks.length > 0);
export const postsWithQuotes = () =>
  blogCorpus().filter((p) => p.blockquotes.length > 0);

/** The longest and shortest posts — the long-title/short-title layout pair. */
export function longestPost(): BlogPost {
  return [...blogCorpus()].sort((a, b) => b.bodyLength - a.bodyLength)[0];
}
export function shortestPost(): BlogPost {
  return [...blogCorpus()].sort((a, b) => a.bodyLength - b.bodyLength)[0];
}

/**
 * The post with the most rich markdown — tables first, then blockquotes.
 *
 * Specs that need "a post with real content in it" should name this rather than
 * a slug. A slug in a spec is a hostage to the next content change; this
 * follows the corpus.
 */
export function richestPost(): BlogPost {
  return [...blogCorpus()].sort(
    (a, b) =>
      b.tables.length - a.tables.length ||
      b.blockquotes.length - a.blockquotes.length ||
      b.bodyLength - a.bodyLength
  )[0];
}
