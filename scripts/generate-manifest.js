#!/usr/bin/env node

/**
 * Generate PWA manifest.json at build time
 * This replaces the dynamic API route for static export compatibility
 */

const fs = require('fs');
const path = require('path');

// Load project configuration
const projectConfigPath = path.join(
  __dirname,
  '../src/config/project-detected.json'
);
let projectConfig = {
  projectName: 'geoLARP',
  projectSlug: 'geolarp',
  projectOwner: 'TortoiseWolfe',
  basePath: '',
};

/**
 * MUST MATCH `src/config/project.config.ts`'s `projectDescription`.
 *
 * This is a plain script and that is TypeScript, so the string cannot be imported and
 * is repeated here. `generated-manifest.test.js` asserts the two agree, because the
 * one thing worse than a duplicated constant is a duplicated constant that drifts.
 *
 * What it replaces was the upstream template's blurb — "a production Next.js and
 * Supabase platform with auth, payments, encrypted messaging" — which described
 * ScriptHammer, not a geolocation RPG, and was what a user read in the install
 * prompt (#97).
 */
const PROJECT_DESCRIPTION =
  'geo-located live action role playing. Real geography, real play.';

// Try to load the auto-detected configuration
if (fs.existsSync(projectConfigPath)) {
  try {
    const detected = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
    projectConfig = {
      ...projectConfig,
      ...detected,
    };
  } catch (error) {
    console.warn(
      'Warning: Could not load project-detected.json:',
      error.message
    );
  }
}

// Use environment variables if available (highest priority)
if (process.env.NEXT_PUBLIC_PROJECT_NAME) {
  projectConfig.projectName = process.env.NEXT_PUBLIC_PROJECT_NAME;
}
if (process.env.NEXT_PUBLIC_PROJECT_OWNER) {
  projectConfig.projectOwner = process.env.NEXT_PUBLIC_PROJECT_OWNER;
}
if (process.env.NEXT_PUBLIC_BASE_PATH !== undefined) {
  projectConfig.basePath = process.env.NEXT_PUBLIC_BASE_PATH;
}

// Generate manifest
const manifest = {
  name: projectConfig.projectName,
  short_name: projectConfig.projectName.substring(0, 12),
  description: `${projectConfig.projectName} — ${PROJECT_DESCRIPTION}`,
  theme_color: '#1a1a2e',
  background_color: '#1a1a2e',
  display: 'standalone',
  start_url: `${projectConfig.basePath}/`,
  scope: `${projectConfig.basePath}/`,
  orientation: 'portrait-primary',
  categories: ['productivity', 'utilities'],
  lang: 'en',
  dir: 'ltr',
  prefer_related_applications: false,
  icons: [
    {
      src: `${projectConfig.basePath}/icon-72.svg`,
      sizes: '72x72',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${projectConfig.basePath}/icon-96.svg`,
      sizes: '96x96',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${projectConfig.basePath}/icon-128.svg`,
      sizes: '128x128',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${projectConfig.basePath}/icon-144.svg`,
      sizes: '144x144',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${projectConfig.basePath}/icon-152.svg`,
      sizes: '152x152',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${projectConfig.basePath}/icon-192.svg`,
      sizes: '192x192',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${projectConfig.basePath}/icon-384.svg`,
      sizes: '384x384',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${projectConfig.basePath}/icon-512.svg`,
      sizes: '512x512',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${projectConfig.basePath}/icon-192x192-maskable.png`,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: `${projectConfig.basePath}/icon-512x512-maskable.png`,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  screenshots: [
    {
      src: `${projectConfig.basePath}/screenshots/desktop.png`,
      sizes: '1920x1080',
      type: 'image/png',
      form_factor: 'wide',
      label: 'Desktop view',
    },
    {
      src: `${projectConfig.basePath}/screenshots/mobile.png`,
      // 750x1334, measured. It said 390x844 — a CSS viewport, not the pixel
      // dimensions of the file. Chrome drops a screenshot whose declared size
      // does not match the image (#659).
      sizes: '750x1334',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Mobile view',
    },
  ],
  shortcuts: [
    {
      name: 'Components',
      url: `${projectConfig.basePath}/components`,
      description: 'View all components',
      icons: [
        {
          src: `${projectConfig.basePath}/icon-96.svg`,
          sizes: '96x96',
        },
      ],
    },
    {
      name: 'Contact',
      url: `${projectConfig.basePath}/contact`,
      description: 'Send us a message',
      icons: [
        {
          src: `${projectConfig.basePath}/icon-96.svg`,
          sizes: '96x96',
        },
      ],
    },
    {
      name: 'Themes',
      url: `${projectConfig.basePath}/themes`,
      description: 'Choose your theme',
      icons: [
        {
          src: `${projectConfig.basePath}/icon-96.svg`,
          sizes: '96x96',
        },
      ],
    },
  ],
  related_applications: [],
  prefer_related_applications: false,
  protocol_handlers: [],
  share_target: {
    action: `${projectConfig.basePath}/share`,
    method: 'POST',
    enctype: 'multipart/form-data',
    params: {
      title: 'title',
      text: 'text',
      url: 'url',
    },
  },
};

/*
 * Write manifest to public directory.
 *
 * `MANIFEST_OUT_DIR` EXISTS SO A TEST NEED NOT WRITE THE REAL FILE (#95).
 *
 * This path is anchored on `__dirname`, so running the generator from a temp
 * directory still overwrote the repo's committed manifest. The test that exercises
 * the generator therefore "restored" it afterwards with
 * `git checkout -- public/manifest.json` — which silently discards a legitimately
 * regenerated manifest in the working tree, and reinstates whatever is committed.
 * That is why the file appeared to revert itself: `pnpm test:scripts` reset it on
 * every run.
 *
 * A destructive `git checkout` in a test is too sharp a tool for "put the file
 * back". Given somewhere else to write, the test does not need to put anything back.
 */
const outDir = process.env.MANIFEST_OUT_DIR
  ? path.resolve(process.env.MANIFEST_OUT_DIR)
  : path.join(__dirname, '../public');
const outputPath = path.join(outDir, 'manifest.json');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log(`✅ Generated manifest.json for ${projectConfig.projectName}`);
console.log(`   Base path: ${projectConfig.basePath || '/'}`);
console.log(`   Output: ${outputPath}`);
