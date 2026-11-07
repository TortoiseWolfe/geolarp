import { describe, expect, it } from 'vitest';
import { getProjectConfig } from '@/config/project.config';
import { rewriteRepoLinks } from './render';

const { projectUrl, basePath } = getProjectConfig();
const blob = (path: string) => `${projectUrl}/blob/main/${path}`;
const raw = (path: string) => `${projectUrl}/raw/main/${path}`;
const doc = (slug: string) => `${basePath}/docs/${slug}/`;

describe('rewriteRepoLinks', () => {
  it('maps a repository doc that is also a /docs entry to its site route', () => {
    expect(
      rewriteRepoLinks(
        '<a href="docs/architecture/README.md">architecture</a>',
        'README.md'
      )
    ).toBe(`<a href="${doc('project-structure')}">architecture</a>`);
  });

  it('preserves a fragment when rewriting to a doc route', () => {
    expect(
      rewriteRepoLinks(
        '<a href="docs/AUTH-SETUP.md#part-1-database-setup">setup</a>',
        'README.md'
      )
    ).toBe(`<a href="${doc('auth-and-sessions')}#part-1-database-setup">setup</a>`);
  });

  it('resolves a relative link against the source file, not the site route', () => {
    expect(
      rewriteRepoLinks(
        '<a href="FORK-CHECKLIST.md">checklist</a>',
        'docs/AUTH-SETUP.md'
      )
    ).toBe(`<a href="${blob('docs/FORK-CHECKLIST.md')}">checklist</a>`);
  });

  it('sends repository files that the site does not serve to GitHub', () => {
    expect(
      rewriteRepoLinks('<a href="LICENSE">license</a>', 'README.md')
    ).toBe(`<a href="${blob('LICENSE')}">license</a>`);
    expect(
      rewriteRepoLinks('<a href="CLAUDE.md">claude</a>', 'README.md')
    ).toBe(`<a href="${blob('CLAUDE.md')}">claude</a>`);
  });

  it('serves images from the raw host so the browser receives an image', () => {
    expect(
      rewriteRepoLinks(
        '<img src="docs/architecture/architecture-detailed.png" alt="diagram">',
        'README.md'
      )
    ).toBe(
      `<img src="${raw('docs/architecture/architecture-detailed.png')}" alt="diagram">`
    );
  });

  it('handles single-quoted attributes', () => {
    expect(
      rewriteRepoLinks("<a href='CONTRIBUTING.md'>contributing</a>", 'README.md')
    ).toBe(`<a href='${blob('CONTRIBUTING.md')}'>contributing</a>`);
  });

  it('leaves already-valid links alone', () => {
    const html =
      '<a href="https://example.com/x">x</a>' +
      '<a href="/pricing">pricing</a>' +
      '<a href="#install">install</a>' +
      '<a href="mailto:hi@example.com">mail</a>';
    expect(rewriteRepoLinks(html, 'README.md')).toBe(html);
  });

  it('leaves a path that climbs out of the repository alone', () => {
    const html = '<a href="../../outside.md">outside</a>';
    expect(rewriteRepoLinks(html, 'docs/features/x.md')).toBe(html);
  });
});
