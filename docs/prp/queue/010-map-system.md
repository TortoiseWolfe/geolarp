# PRP-009: Map System

## Status

Queue

## Priority

Medium

## Overview

Create an offline-capable map component using React that displays OpenStreetMap tiles, caches them for offline use, and shows game elements.

## Success Criteria

- [ ] OpenStreetMap tiles displayed
- [ ] Tiles cached in IndexedDB
- [ ] Player position and heading shown
- [ ] Encounter markers displayed
- [ ] Fog of war implemented
- [ ] 1-3 mile radius expansion working
- [ ] Vector shape fallback offline
- [ ] Pinch-to-zoom functional
- [ ] Distance measurements shown
- [ ] POI highlighting working

## Technical Requirements

### Map Component

```typescript
interface MapProps {
  center: Coordinates;
  zoom: number;
  showPlayer: boolean;
  showEncounters: boolean;
  showFog: boolean;
  radius: number; // miles
}

interface MapTile {
  x: number;
  y: number;
  z: number;
  url: string;
  blob?: Blob;
  cached: boolean;
  timestamp: number;
}
```

### Caching Strategy

- Cache tiles within 1 mile initially
- Expand to 3 miles over time
- 500 tile limit
- 30-day expiry
- LRU replacement
- Progressive download

### Offline Fallback

- Vector shapes for roads
- Simplified polygons
- Cached POI data
- Grid overlay
- Compass rose

## Testing Requirements

- Tile caching tests
- Offline mode validation
- Zoom/pan performance
- Memory usage tests
- Touch interaction tests

## Acceptance Criteria

1. Map loads and displays
2. Tiles cache for offline
3. Player tracking works
4. Fog of war functional
5. Offline fallback works

## Rotation Plan

- Extract tile strategy to ADR
- Offline approach documented
- Archive after implementation
- Tests validate caching

---

_Created: 2024-12-07_
_Estimated effort: 4 days_
