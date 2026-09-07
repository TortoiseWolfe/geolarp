/**
 * `public/manifest.json` is generated at build time and deliberately tracked (#392).
 *
 * WHY TRACKED, given it is a build output. Same reasoning as `public/robots.txt`
 * (#504): a committed copy is reviewable, so a local variant build that rewrites it
 * appears in a diff instead of shipping quietly. The alternative — untracking it —
 * would also mean a fresh clone's dev server 404s on the manifest, because `dev`
 * never runs the generators.
 *
 * WHAT ACTUALLY GOES WRONG. `DISABLE_BASE_PATH=true` is the documented recipe for a
 * local CI-matching E2E run, and running it rewrites this file:
 *
 *     -  "start_url": "/geoLARP/",      +  "start_url": "/",
 *     -  "scope":     "/geoLARP/",      +  "scope":     "/",
 *     -  "src": "/geoLARP/icon-72.svg"  +  "src": "/icon-72.svg"
 *
 * `git add -A` is the natural way to lose that, and the diff reads as harmless
 * config churn. On GitHub Pages under `/geoLARP/` it breaks PWA install and
 * offline. This test is what turns that into a failing check.
 *
 * WHAT THIS DOES **NOT** CLAIM. The committed copy is not what production serves.
 * geolarp.com runs at the apex with no base path, and its deploy regenerates
 * the file — live values are `/`, while the committed copy is the default GitHub
 * Pages variant. So this pins the tracked artifact to the repo's DEFAULT
 * configuration, which is the thing a reviewer sees; production correctness is the
 * deploy's job, not this file's.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'manifest.json');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate-manifest.js');
const PROJECT_CONFIG_PATH = path.join(
  ROOT,
  'src',
  'config',
  'project.config.ts'
);

/**
 * The default base path, read from the tracked config rather than hardcoded.
 *
 * `src/config/project-detected.json` holds the real detected value but is
 * gitignored, so it cannot be the source of truth for a test that must pass on a
 * clean checkout.
 */
function trackedField(name) {
  const src = fs.readFileSync(PROJECT_CONFIG_PATH, 'utf8');
  const match = new RegExp(`${name}:\\s*'([^']+)'`).exec(src);
  assert.ok(match, `could not read ${name} from src/config/project.config.ts`);
  return match[1];
}

/**
 * The base path is built from the SLUG, never the display name (#97).
 *
 * This used to read `projectName`, which was both at the time. GitHub Pages serves a
 * repo called `geolarp` at `/geolarp/`, so a display-cased `/geoLARP/` here would 404
 * every icon and break PWA install on any fork deploying with the default — the exact
 * artifact this file exists to keep reviewable.
 */
function defaultBasePath() {
  return `/${trackedField('projectSlug')}`;
}

const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

test('the committed manifest is not a base-path-disabled build', () => {
  const manifest = readManifest();
  const base = defaultBasePath();

  assert.strictEqual(
    manifest.start_url,
    `${base}/`,
    `start_url is "${manifest.start_url}". A local build with DISABLE_BASE_PATH=true ` +
      `rewrites this file; committing that ships a manifest whose start_url, scope ` +
      `and icon paths all point at the wrong root, which breaks PWA install and offline.`
  );
  assert.strictEqual(
    manifest.scope,
    `${base}/`,
    `scope is "${manifest.scope}" — see start_url above, same cause`
  );
});

test('every icon in the committed manifest shares the manifest scope', () => {
  const manifest = readManifest();

  assert.ok(
    Array.isArray(manifest.icons) && manifest.icons.length > 0,
    'the manifest declares no icons, so this check would be vacuous'
  );

  // Internal consistency, independent of what the base path happens to be: an
  // icon that does not sit under the scope is unreachable to the installed app.
  const strays = manifest.icons
    .map((icon) => icon.src)
    .filter((src) => !src.startsWith(manifest.scope));

  assert.deepStrictEqual(
    strays,
    [],
    `icon path(s) outside the manifest scope "${manifest.scope}"`
  );
});

test('the generator applies the base path it is given, to every field', () => {
  // The companion to the pin above: the committed copy could be correct while the
  // generator that produces it is not, and a reviewer would never see it.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'geolarp-manifest-'));
  fs.mkdirSync(path.join(fixture, 'public'), { recursive: true });

  try {
    const result = spawnSync(process.execPath, [GENERATOR_PATH], {
      cwd: fixture,
      encoding: 'utf8',
      env: {
        ...process.env,
        NEXT_PUBLIC_BASE_PATH: '/Fixture',
        NEXT_PUBLIC_PROJECT_NAME: 'Fixture',
        NEXT_PUBLIC_PROJECT_OWNER: 'ExampleOwner',
      },
    });
    assert.strictEqual(
      result.status,
      0,
      `manifest generator failed:\n${result.stderr || result.stdout}`
    );

    // The generator writes relative to its own directory, not cwd, so read it back
    // from the repo and restore it afterwards — see the finally block.
    const generated = readManifest();
    assert.strictEqual(generated.start_url, '/Fixture/');
    assert.strictEqual(generated.scope, '/Fixture/');
    assert.ok(
      generated.icons.every((icon) => icon.src.startsWith('/Fixture/')),
      'an icon path ignored the configured base path'
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    // Put the committed copy back: the generator overwrote it.
    const restore = spawnSync(
      'git',
      ['checkout', '--', 'public/manifest.json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    );
    assert.strictEqual(
      restore.status,
      0,
      `could not restore public/manifest.json after the generator run:\n${restore.stderr}`
    );
  }
});

/**
 * THE DISPLAY NAME MUST SURVIVE DETECTION (#97).
 *
 * `detect-project.js` takes the project name from the git remote, which is the slug —
 * lowercase, because that is what the repository is called. That value used to flow
 * straight into the PWA's `name`, and production shipped `"name": "geolarp"` in its
 * install prompt while the page `<title>` said `geoLARP`, because the two came from
 * different places.
 *
 * Asserting the literal `geoLARP` would be the wrong test for a template: a fork of
 * `mygame` must be called `mygame`. What is asserted is the RULE — the manifest's name
 * matches the tracked display name, and differs from the slug only in case.
 */
test('the manifest display name is the tracked name, not the URL slug', () => {
  const manifest = readManifest();
  const name = trackedField('projectName');
  const slug = trackedField('projectSlug');

  assert.strictEqual(
    manifest.name,
    name,
    `manifest name is "${manifest.name}"; detection overwrote the tracked display ` +
      `name "${name}" with something else — most likely the git remote's slug.`
  );
  assert.strictEqual(manifest.short_name, name);

  // The two must be the same word. If they ever diverge beyond case, the rule above
  // ("casing wins only when the name IS the slug") no longer holds and the fork
  // behaviour in `displayNameFor` needs rethinking rather than this test relaxing.
  assert.strictEqual(
    name.toLowerCase(),
    slug.toLowerCase(),
    `projectName "${name}" and projectSlug "${slug}" are different words, not one ` +
      `word in two cases. See displayNameFor() in scripts/detect-project.js.`
  );
  assert.notStrictEqual(
    name,
    slug,
    'projectName and projectSlug are identical, so this test proves nothing — it ' +
      'exists because they differ in case.'
  );
});

/**
 * The description a user reads in the install prompt must be this project's.
 *
 * It was the upstream template's blurb ("a production Next.js and Supabase platform
 * with auth, payments, encrypted messaging"), which describes ScriptHammer rather than
 * a geolocation RPG. `generate-manifest.js` is plain JS and cannot import the
 * TypeScript config, so the string is duplicated there; this is what stops the copy
 * from drifting.
 */
test('the manifest description matches the tracked project description', () => {
  const manifest = readManifest();
  const description = trackedField('projectDescription');

  assert.ok(
    manifest.description.includes(description),
    `manifest description is "${manifest.description}", which does not contain the ` +
      `tracked projectDescription "${description}". The duplicated constant in ` +
      `scripts/generate-manifest.js has drifted from src/config/project.config.ts.`
  );
  assert.doesNotMatch(
    manifest.description,
    /production Next\.js and Supabase platform/,
    'the manifest still carries the upstream template boilerplate (#97)'
  );
});
