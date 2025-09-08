# PRP-007: Encounter Engine

## Status

Active

## Priority

Medium

## Overview

Create a deterministic encounter generation system using GPS coordinates to create consistent, repeatable encounters in a 100m grid. Encounters use D7 difficulty scaling with Challenge Ratings (CR) balanced for the unique probability curve.

## Success Criteria

- [ ] Deterministic generation from coordinates
- [ ] Seeded random number generator working
- [ ] 100m grid cell system implemented
- [ ] Five encounter types functional
- [ ] D7-based Challenge Rating (CR) system
- [ ] Difficulty scaling by player level and party size
- [ ] Daily refresh mechanism
- [ ] IndexedDB storage working
- [ ] 3x3 grid generation around player
- [ ] Rarity system with D7 loot rolls
- [ ] Environmental modifiers for location types

## Technical Requirements

### Encounter Types

```typescript
enum EncounterType {
  MONSTER = 'monster', // Combat encounter
  NPC = 'npc', // Dialogue/trade
  TREASURE = 'treasure', // Loot discovery
  SHRINE = 'shrine', // Temporary buffs
  TRAP = 'trap', // Environmental challenge
}

interface Encounter {
  id: string; // Hash of coordinates
  type: EncounterType;
  coordinates: GridCell;
  challengeRating: number; // CR relative to player level
  difficultyDC: number; // D7 DC (2-7+ scale)
  rarity: Rarity;
  rewards: Reward[];
  discovered: boolean;
  respawnTime: number;
  environmentModifier: number; // -1 to +2 based on location
}

interface ChallengeRating {
  easy: 'playerLevel - 1'; // DC 3-4
  moderate: 'playerLevel'; // DC 4-5
  hard: 'playerLevel + 1'; // DC 5-6
  deadly: 'playerLevel + 2'; // DC 6-7
  legendary: 'playerLevel + 3'; // DC 7+ (requires advantages)
}
```

### Generation Algorithm

```typescript
function generateEncounter(
  lat: number,
  lng: number,
  date: Date,
  playerLevel: number,
) {
  const gridLat = Math.floor(lat * 10) / 10; // 100m grid
  const gridLng = Math.floor(lng * 10) / 10;
  const seed = hash(`${gridLat},${gridLng},${date.toDateString()}`);
  const rng = seedrandom(seed);

  // D7 Difficulty Scaling
  const baseDC = Math.floor(rng() * 7) + 1; // 1-7
  const cr = calculateCR(baseDC, playerLevel);

  // Environmental bonus/penalty
  const envMod = getEnvironmentModifier(lat, lng);
  const finalDC = Math.max(2, Math.min(7, baseDC + envMod));

  return encounter;
}

function calculateCR(baseDC: number, playerLevel: number): number {
  const difficultyMap = {
    2: playerLevel - 2, // Trivial
    3: playerLevel - 1, // Easy
    4: playerLevel, // Moderate
    5: playerLevel + 1, // Hard
    6: playerLevel + 2, // Very Hard
    7: playerLevel + 3, // Extreme
  };
  return Math.max(1, difficultyMap[baseDC] || playerLevel);
}
```

### D7 Loot Table & Rarity

Roll 1D7 when defeating encounters:

```typescript
interface LootTable {
  1: null; // Nothing (14.3%)
  2: 'common'; // Basic consumable (14.3%)
  3: 'common'; // Basic consumable (14.3%)
  4: 'uncommon'; // Equipment piece (14.3%)
  5: 'uncommon'; // Equipment piece (14.3%)
  6: 'rare'; // Magical item (14.3%)
  7: 'epic'; // Unique item (14.3%)
}

// Legendary items only from CR+3 encounters with natural 7
interface EncounterRewards {
  xp: number; // CR * 7 * difficultyMultiplier
  loot: LootRoll;
  reputation: number; // +1 for moderate, +2 for hard, +3 for extreme
}
```

### Group Encounter Scaling

When multiple enemies present:

- **2 enemies**: Each CR -1, total DC +1
- **3-4 enemies**: Each CR -2, total DC +2
- **5+ enemies**: Each CR -3, total DC +3
- **Swarm**: Single entity with HP multiplier

## Testing Requirements

- Determinism validation (same seed = same encounter)
- Grid system accuracy (100m cells)
- D7 difficulty scaling tests (DC 2-7 range)
- Challenge Rating balance validation
- Loot table probability distribution (14.3% per face)
- Environmental modifier application
- Group encounter difficulty scaling
- Performance with many encounters
- XP reward calculations (base \* 7)

## Acceptance Criteria

1. Same coordinates = same encounter (deterministic)
2. Daily refresh working with new seed
3. D7 difficulty scales properly (DC 2-7)
4. Challenge Rating adjusts to player level
5. All encounter types spawn with correct frequency
6. Loot rolls follow D7 distribution (14.3% per outcome)
7. Environmental modifiers affect final DC
8. XP rewards scale with CR (\* 7 multiplier)
9. Group encounters properly balanced

## Rotation Plan

- Extract generation algorithm to docs
- Rarity system to ADR
- Archive after implementation
- Tests validate determinism

---

_Created: 2024-12-07_
_Updated: 2025-01-08_
_Estimated effort: 3 days_
