# Product Requirement Prompt: geoLARP Beta PWA

## Status
Master Requirements Document

## Product Vision
Build a Progressive Web App (PWA) for geo-located live action role-playing that transforms the real world into a game board. Players use their phones as character sheets to engage in location-based RPG adventures without requiring backend infrastructure.

## Technical Constraints
- Static hosting only (GitHub Pages)
- No backend/database servers
- Offline-first functionality required
- Must work on all modern mobile browsers
- Privacy-first with no user tracking

## Core Requirements

### 1. Character System
**Requirement:** D7 dice-based RPG system
- Players roll 1-7 sided dice for all actions
- Character attributes: Strength, Agility, Intellect, Spirit, Luck
- Characters stored in browser LocalStorage
- Auto-generated characters in <10 seconds
- Character export/import via JSON files
- Warning system about data persistence limitations

### 2. Geolocation Features
**Requirement:** Location-based gameplay with privacy protection
- Use browser Geolocation API
- Graceful fallbacks for denied permissions:
  - IP-based location
  - Manual zone selection
  - Grid-based movement
- 100m precision rounding for privacy
- Deterministic encounters based on coordinates
- Battery-optimized tracking

### 3. Game Mechanics
**Requirement:** Offline-capable RPG gameplay
- Draggable dice with physics simulation
- Inventory management with drag-and-drop
- Quest generation based on location
- Exploration challenges (walk 1/4 mile)
- Location-based character classes

### 4. Offline Capabilities
**Requirement:** Full functionality without internet
- Service worker implementation
- Cached map tiles (1-3 mile radius)
- Local encounter generation
- Offline quest completion
- Progressive enhancement when online

### 5. Data Persistence
**Requirement:** Client-side only storage
- LocalStorage for character data
- IndexedDB for map tiles
- Export character to clipboard/file
- QR code generation for sharing
- Clear data warnings

### 6. User Conversion
**Requirement:** Beta to full platform pipeline
- Email capture without backend (EmailJS/Formspree)
- "Save character forever" CTAs
- Achievement milestone prompts
- Newsletter signup incentives
- Migration path to future WordPress backend

## Success Metrics
- Player completes character creation < 30 seconds
- 3+ play sessions per user
- 0.5+ miles walked per session
- 20% email capture rate
- 40% retention after cache clear

## Deliverables
1. Deployable PWA on GitHub Pages
2. Offline-capable game client
3. Character management system
4. Location-based encounter engine
5. Email capture mechanism
6. Documentation for players

## Non-Functional Requirements
- Performance: 60fps dice animations
- Accessibility: WCAG 2.1 AA compliant
- Security: No PII transmitted
- Privacy: GDPR compliant, no tracking
- Compatibility: iOS 14+, Android 8+

## Implementation Order
See individual PRPs 001-020 in queue/ directory for implementation sequence.

---
*Master PRP - Not for archival*
*Created: 2024-12-07*