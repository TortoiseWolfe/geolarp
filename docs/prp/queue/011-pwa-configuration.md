# PRP-010: PWA Configuration

## Status

Queue

## Priority

High

## Overview

Configure complete PWA setup for Next.js including manifest, install prompts, splash screens, and all PWA features.

## Success Criteria

- [ ] Manifest.json with all icon sizes
- [ ] Custom install prompt component
- [ ] iOS installation instructions
- [ ] Splash screens for all devices
- [ ] Orientation locked to portrait
- [ ] Status bar customized
- [ ] Deep linking support
- [ ] App shortcuts configured
- [ ] Update notifications working

## Technical Requirements

### Manifest Configuration

```json
{
  "name": "geoLARP",
  "short_name": "geoLARP",
  "description": "Location-based RPG",
  "display": "fullscreen",
  "orientation": "portrait",
  "theme_color": "#1a1a2e",
  "background_color": "#0f0f23",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icon-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    { "name": "New Character", "url": "/character/new" },
    { "name": "Continue", "url": "/game" }
  ]
}
```

### Install Prompt Component

- Detect install capability
- Custom UI for install
- iOS instructions modal
- Deferred prompt handling
- Success tracking

## Testing Requirements

- Lighthouse PWA audit
- Install flow testing
- iOS/Android validation
- Update mechanism tests
- Deep linking tests

## Acceptance Criteria

1. PWA installable on all platforms
2. Lighthouse score > 90
3. Updates handled gracefully
4. Shortcuts functional
5. iOS instructions clear

## Rotation Plan

- PWA decisions to ADR
- Platform quirks documented
- Archive after implementation
- Tests validate PWA features

---

_Created: 2024-12-07_
_Estimated effort: 2 days_
