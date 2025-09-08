# PRP-001: Project Setup

## Status

Complete

## Priority

Critical

## Overview

Create a Next.js 14+ PWA project structure for geoLARP that supports static hosting on GitHub Pages with offline capabilities.

## Success Criteria

- [ ] Next.js 14+ with TypeScript and React 18 configured
- [ ] Static export working for GitHub Pages
- [ ] PWA manifest and service worker setup with @serwist/next
- [ ] GitHub Actions workflow for automated deployment
- [ ] App router (not pages) properly configured
- [ ] basePath and assetPrefix configured for subdirectory hosting

## Technical Requirements

### Project Structure

```
src/
├── app/           # App router pages
├── components/    # React components
│   ├── game/     # Game-specific components
│   └── ui/       # UI components
├── hooks/        # Custom React hooks
├── lib/          # Utilities and helpers
├── store/        # State management
└── types/        # TypeScript definitions
```

### Dependencies Required

- Offline storage: dexie, localforage
- Dice physics: @3d-dice/dice-box
- Drag and drop: @dnd-kit/core
- State management: zustand
- Email capture: @emailjs/browser
- QR codes: qrcode
- PWA: @serwist/next

### Configuration Files

- next.config.js with static export
- manifest.json for PWA
- GitHub Actions workflow
- TypeScript configuration
- Tailwind CSS setup

## Testing Requirements

- Build completes successfully
- Static export generates all files
- PWA lighthouse score > 90
- GitHub Actions deploys to Pages

## Acceptance Criteria

1. Project builds and runs locally
2. Static export works
3. Deploys to GitHub Pages
4. PWA installable
5. TypeScript configured

## Rotation Plan

- Extract deployment decisions to ADR
- Archive after project runs on GitHub Pages
- Tests validate build process

---

_Created: 2024-12-07_
_Estimated effort: 2 days_
