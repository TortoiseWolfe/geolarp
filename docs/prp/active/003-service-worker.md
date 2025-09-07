# PRP-003: Service Worker

## Status
Queue

## Priority
Critical

## Overview
Create a comprehensive service worker using Serwist that provides offline functionality, caching strategies, and progressive updates.

## Success Criteria
- [ ] All game assets precached
- [ ] Map tiles cached with 30-day expiry
- [ ] Network-first for API calls with 10s timeout
- [ ] Offline fallback page working
- [ ] Background sync implemented
- [ ] Cache size limits enforced (500 entries)
- [ ] Graceful updates without breaking gameplay
- [ ] TypeScript types complete

## Technical Requirements

### Caching Strategies
```typescript
// Precache list
const precacheAssets = [
  '/index.html',
  '/manifest.json',
  '/icons/*',
  '/sounds/*',
  '/fonts/*'
];

// Runtime caching
const cacheStrategies = {
  mapTiles: 'CacheFirst', // 30 day expiry
  gameData: 'NetworkFirst', // 10s timeout
  images: 'StaleWhileRevalidate',
  api: 'NetworkOnly'
};
```

### Service Worker Features
- Install, activate, fetch event handlers
- skipWaiting for immediate activation
- Clients claim for immediate control
- Message passing with main thread
- Update notifications
- Quota management
- Background sync queue

## Testing Requirements
- Offline mode tests
- Cache invalidation tests
- Update flow tests
- Background sync tests
- Performance benchmarks

## Acceptance Criteria
1. Game works fully offline
2. Updates don't break active sessions
3. Cache limits respected
4. Background sync functional
5. TypeScript types enforced

## Rotation Plan
- Extract caching strategy to ADR
- Document update strategy
- Archive after implementation
- Tests validate offline functionality

---
*Created: 2024-12-07*
*Estimated effort: 2 days*