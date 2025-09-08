# PRP-002: Offline Database

## Status
Complete

## Priority
Critical

## Overview
Build an IndexedDB database wrapper using Dexie for PWA game storage with automatic quota management and TypeScript support.

## Success Criteria
- [x] IndexedDB wrapper implemented with Dexie
- [x] Map tiles stored with automatic cleanup
- [x] Character data persisted with versioning
- [x] Encounter data cached by coordinates
- [x] Storage quota management working
- [x] Data export/import functional
- [x] TypeScript interfaces complete

## Technical Requirements

### Database Schema
```typescript
interface MapTile {
  id: string; // "x,y,zoom"
  x: number;
  y: number;
  zoom: number;
  blob: Blob;
  timestamp: number;
}

interface Character {
  id: string;
  name: string;
  level: number;
  attributes: Attributes;
  inventory: Item[];
  position: Coordinates;
  version: number;
}

interface GameState {
  currentQuest: Quest;
  achievements: Achievement[];
  statistics: Statistics;
  lastPlayed: number;
}

interface Encounter {
  id: string;
  coordinates: Coordinates;
  type: EncounterType;
  discovered: boolean;
  respawnTime: number;
}
```

### Storage Management
- Automatic cleanup when > 80% full
- LRU cache for map tiles
- 30-day expiry for tiles
- Character data encryption
- Version migration support

### API Methods
- `saveCharacter(character: Character): Promise<void>`
- `loadCharacter(id: string): Promise<Character>`
- `cacheTile(tile: MapTile): Promise<void>`
- `getTile(x: number, y: number, zoom: number): Promise<Blob>`
- `exportData(): Promise<ExportBundle>`
- `importData(bundle: ExportBundle): Promise<void>`
- `clearOldData(daysOld: number): Promise<void>`

## Testing Requirements
- Unit tests for all database operations
- Storage quota handling tests
- Migration tests between versions
- Performance tests for large datasets
- Offline functionality tests

## Acceptance Criteria
1. Database operations work offline
2. Storage limits handled gracefully
3. Data persists between sessions
4. Export/import functioning
5. TypeScript types enforced

## Rotation Plan
- Extract storage decisions to ADR
- Move encryption approach to ADR
- Archive after implementation
- Tests become permanent validation

---
*Created: 2024-12-07*
*Estimated effort: 3 days*