#!/usr/bin/env node

/**
 * Auto-detects project information from git remote URL
 * Generates project configuration for build-time use
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitRemoteUrl() {
  try {
    const url = execSync('git remote get-url origin', {
      encoding: 'utf8',
    }).trim();
    return url;
  } catch (error) {
    console.warn('Warning: Not a git repository or no remote origin set');
    return null;
  }
}

function parseGitUrl(url) {
  if (!url) return null;

  // Handle different Git URL formats
  const patterns = [
    // HTTPS: https://github.com/username/repo.git
    /https?:\/\/github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/,
    // SSH: git@github.com:username/repo.git
    /git@github\.com:([^\/]+)\/([^\/\.]+)(\.git)?$/,
    // GitHub CLI: gh:username/repo
    /gh:([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        isGitHub: true,
      };
    }
  }

  // Try generic git URL parsing for other hosts.
  // ^ anchor + @ in the host exclusion class are both load-bearing: without
  // them, `git@@github.com:user/repo` matches and captures `@github.com` as
  // the host — garbage that silently propagates into basePath/projectUrl.
  const genericPattern =
    /^(?:git@|https?:\/\/)([^:\/@]+)[:\/]([^\/]+)\/([^\/\.]+)(?:\.git)?$/;
  const genericMatch = url.match(genericPattern);
  if (genericMatch) {
    return {
      host: genericMatch[1],
      owner: genericMatch[2],
      repo: genericMatch[3],
      isGitHub: genericMatch[1].includes('github'),
    };
  }

  return null;
}

function getProjectInfo() {
  // Check for environment variable overrides first
  if (
    process.env.NEXT_PUBLIC_PROJECT_NAME &&
    process.env.NEXT_PUBLIC_PROJECT_OWNER
  ) {
    return {
      projectName: process.env.NEXT_PUBLIC_PROJECT_NAME,
      projectOwner: process.env.NEXT_PUBLIC_PROJECT_OWNER,
      isGitHub: true,
      source: 'env',
    };
  }

  // Try to detect from git
  const gitUrl = getGitRemoteUrl();
  const gitInfo = parseGitUrl(gitUrl);

  if (gitInfo) {
    return {
      projectName: gitInfo.repo,
      projectOwner: gitInfo.owner,
      projectHost: gitInfo.host || 'github.com',
      isGitHub: gitInfo.isGitHub,
      source: 'git',
      gitUrl: gitUrl,
    };
  }

  // Fallback to defaults
  return {
    projectName: 'geoLARP',
    projectOwner: 'TortoiseWolfe',
    projectHost: 'github.com',
    isGitHub: true,
    source: 'default',
  };
}

/**
 * The name a human wrote, as opposed to the slug GitHub serves.
 *
 * ONE FIELD WAS DOING TWO JOBS (#97). `projectName` came from the git remote, so it was
 * the repository slug — correctly lowercase, because that is what the repo is called and
 * what GitHub Pages serves at `/<repo>/`. But the same value was also the PWA's `name`,
 * the nav label, the `<title>`, the blog's schema.org publisher and the email templates.
 * Production shipped `"name": "geolarp"` in its install prompt as a result, while the
 * page title said `geoLARP` because that one came from elsewhere.
 *
 * WHY NOT JUST HARD-CODE THE CASING. This is a template. A fork of `mygame` must be
 * called `mygame`, not `geoLARP` — casing the name unconditionally would be the same
 * fork trap as the `scripthammer` compose literal in #13, pointing the other way.
 *
 * So the rule is narrow: a display name only overrides the slug when it IS the slug,
 * differing in case alone. `geolarp` -> `geoLARP` (same repo, human casing wins);
 * `mygame` -> `mygame` (a real fork, detection wins). An explicit
 * `NEXT_PUBLIC_PROJECT_NAME` beats both, which is how a fork sets a name that is not
 * its slug at all.
 */
const DISPLAY_NAME = 'geoLARP';

function displayNameFor(slug) {
  if (process.env.NEXT_PUBLIC_PROJECT_NAME) {
    return process.env.NEXT_PUBLIC_PROJECT_NAME;
  }
  return String(slug).toLowerCase() === DISPLAY_NAME.toLowerCase()
    ? DISPLAY_NAME
    : slug;
}

function generateConfig() {
  const info = getProjectInfo();

  // Determine if we're in GitHub Actions CI/CD
  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

  // Explicit opt-out for jobs that serve the static export from the ROOT
  // (e.g. the E2E workflow's `serve out -l 3000`). Without this, the build
  // bakes in the GitHub Pages basePath (/RepoName) and every
  // /RepoName/_next/*.js asset 404s when served at /, so React never hydrates
  // and the whole E2E suite fails. A step-level `GITHUB_ACTIONS: false` is NOT
  // reliable — the runner re-injects GITHUB_ACTIONS=true into the child
  // processes spawned by `pnpm build` / next.config's execSync — so we need an
  // unambiguous, dedicated signal that survives that.
  const basePathDisabled = process.env.DISABLE_BASE_PATH === 'true';

  // Check if using custom domain (CNAME file exists)
  const cnameExists = fs.existsSync(
    path.join(__dirname, '..', 'public', 'CNAME')
  );

  // Base path: explicit disable wins; then explicit env var; then
  // auto-detection for the GitHub Pages deploy build.
  const basePath = basePathDisabled
    ? ''
    : process.env.NEXT_PUBLIC_BASE_PATH ||
      // `info.projectName` here is the RAW detected value, i.e. the slug — the display
      // name is derived from it below, deliberately after this point. GitHub Pages
      // serves a repo named `geolarp` at `/geolarp/`, so a display-cased `/geoLARP/`
      // would 404 every icon and break PWA install on a fork (#97).
      (isGitHubActions && info.isGitHub && !cnameExists
        ? `/${info.projectName}`
        : '');

  // `projectSlug` is what GitHub serves and what a URL must contain; `projectName` is
  // what a person reads. Everything below picks one on purpose — see `displayNameFor`.
  const projectSlug = info.projectName;

  const config = {
    projectName: displayNameFor(projectSlug),
    projectSlug,
    projectOwner: info.projectOwner,
    projectHost: info.projectHost || 'github.com',
    // The SLUG, never the display name: `https://github.com/owner/geoLARP` 404s.
    projectUrl: info.isGitHub
      ? `https://github.com/${info.projectOwner}/${projectSlug}`
      : info.gitUrl || '',
    basePath: basePath,
    isGitHub: info.isGitHub,
    detectionSource: info.source,
    generatedAt: new Date().toISOString(),
  };

  // Write to multiple formats for flexibility
  const configDir = path.join(__dirname, '..', 'src', 'config');

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Write JSON version
  const jsonPath = path.join(configDir, 'project-detected.json');
  fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2));

  // Write TypeScript module
  const tsContent = `// Auto-generated by detect-project.js
// DO NOT EDIT MANUALLY - This file is regenerated on each build

export const detectedConfig = ${JSON.stringify(config, null, 2)} as const;

export type DetectedConfig = typeof detectedConfig;
`;

  const tsPath = path.join(configDir, 'project-detected.ts');
  fs.writeFileSync(tsPath, tsContent);

  // Write .env.local if it doesn't exist
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    const envContent = `# Auto-generated project configuration
NEXT_PUBLIC_PROJECT_NAME=${config.projectName}
NEXT_PUBLIC_PROJECT_OWNER=${config.projectOwner}
NEXT_PUBLIC_BASE_PATH=${config.basePath}
`;
    fs.writeFileSync(envPath, envContent);
  }

  console.log('✅ Project configuration detected:');
  console.log(`   Name: ${config.projectName}`);
  console.log(`   Owner: ${config.projectOwner}`);
  console.log(`   Base Path: ${config.basePath || '/'}`);
  console.log(`   Source: ${config.detectionSource}`);

  return config;
}

// Run if called directly
if (require.main === module) {
  generateConfig();
}

module.exports = { generateConfig, getProjectInfo, parseGitUrl };
