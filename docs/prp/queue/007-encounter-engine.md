# PRP-007: Encounter Engine

## Status
Queue

## Priority
Medium

## Overview
Create a deterministic encounter generation system using GPS coordinates to create consistent, repeatable encounters in a 100m grid.

## Success Criteria
- [ ] Deterministic generation from coordinates
- [ ] Seeded random number generator working
- [ ] 100m grid cell system implemented
- [ ] Five encounter types functional
- [ ] Difficulty scaling by player level
- [ ] Daily refresh mechanism
- [ ] IndexedDB storage working
- [ ] 3x3 grid generation around player
- [ ] Rarity system implemented

## Technical Requirements

### Encounter Types
```typescript
enum EncounterType {
  MONSTER = 'monster',     // Combat encounter
  NPC = 'npc',            // Dialogue/trade
  TREASURE = 'treasure',   // Loot discovery
  SHRINE = 'shrine',       // Temporary buffs
  TRAP = 'trap'           // Environmental challenge
}

interface Encounter {
  id: string;              // Hash of coordinates
  type: EncounterType;
  coordinates: GridCell;
  level: number;
  rarity: Rarity;
  rewards: Reward[];
  discovered: boolean;
  respawnTime: number;
}
```

### Generation Algorithm
```typescript
function generateEncounter(lat: number, lng: number, date: Date) {
  const gridLat = Math.floor(lat * 10) / 10;  // 100m grid
  const gridLng = Math.floor(lng * 10) / 10;
  const seed = hash(`${gridLat},${gridLng},${date.toDateString()}`);
  const rng = seedrandom(seed);
  // Generate encounter properties
}
```

### Rarity Distribution
- Common: 60%
- Uncommon: 25%
- Rare: 10%
- Epic: 4%
- Legendary: 1%

## Testing Requirements
- Determinism validation
- Grid system accuracy
- Difficulty scaling tests
- Rarity distribution tests
- Performance with many encounters

## Acceptance Criteria
1. Same coordinates = same encounter
2. Daily refresh working
3. Difficulty scales properly
4. All encounter types spawn
5. Rarity distribution correct

## Rotation Plan
- Extract generation algorithm to docs
- Rarity system to ADR
- Archive after implementation
- Tests validate determinism

---
*Created: 2024-12-07*
*Estimated effort: 3 days*