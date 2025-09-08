# PRP-008: Quest System

## Status
Active

## Priority
Medium

## Overview
Build an AI gamemaster quest system that generates location-based quests without backend, creates exploration challenges using D7 difficulty checks, and adapts to player behavior. Quests scale with D7 DCs and provide XP rewards based on the 7x multiplier system.

## Success Criteria
- [ ] Location-based quest generation with D7 DCs
- [ ] Exploration challenges with distance-based difficulty
- [ ] Four quest types with D7 success checks
- [ ] Offline progress tracking
- [ ] Procedural descriptions generated
- [ ] XP rewards using 7x multiplier system
- [ ] D7 loot rolls for item rewards
- [ ] Quest chains with escalating difficulty
- [ ] Behavior adaptation based on success rates
- [ ] Template system with D7 mechanics integration

## Technical Requirements

### Quest Types
```typescript
enum QuestType {
  EXPLORATION = 'exploration',  // Visit X locations
  COLLECTION = 'collection',    // Find Y items
  COMBAT = 'combat',           // Defeat Z enemies
  SOCIAL = 'social'            // Find players via QR
}

interface Quest {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  objectives: Objective[];
  difficultyDC: number;        // D7 DC (2-7)
  rewards: QuestReward;
  progress: Progress;
  chainId?: string;
  chainPosition?: number;      // Position in quest chain
  expiresAt?: Date;
}

interface Objective {
  description: string;
  targetValue: number;
  currentValue: number;
  checkDC?: number;           // D7 DC for skill checks
  requiresRoll?: boolean;     // If true, requires D7 roll to complete
}

interface QuestReward {
  xp: number;                 // Base XP * 7 * difficulty multiplier
  lootRolls: number;          // Number of D7 loot rolls
  guaranteedItems?: Item[];   // Fixed rewards
  reputation: number;         // Social standing increase
}
```

### Quest Generation with D7 Scaling

#### Distance-Based Difficulty
```typescript
interface DistanceDifficulty {
  '0.1 miles': { dc: 2, xp: 7 };      // Trivial
  '0.25 miles': { dc: 3, xp: 14 };    // Easy
  '0.5 miles': { dc: 4, xp: 35 };     // Moderate
  '1 mile': { dc: 5, xp: 70 };        // Hard
  '2 miles': { dc: 6, xp: 140 };      // Very Hard
  '3+ miles': { dc: 7, xp: 280 };     // Extreme
}
```

#### Quest Difficulty Tiers
- **Short** (DC 3): 1D7 objectives, nearby locations
- **Medium** (DC 4): 2D7 objectives, moderate travel
- **Long** (DC 5): 3D7 objectives, significant exploration
- **Epic** (DC 6+): Multiple stages, rare rewards

#### Chain Progression
```typescript
interface QuestChain {
  stages: Quest[];
  difficultyProgression: number[]; // [3, 4, 5, 6] for escalating DCs
  finalReward: {
    xp: number;        // Total * 1.5 for chain completion
    epicItem: boolean; // Guaranteed epic on natural 7
  };
}

### Template System with D7 Integration
```typescript
interface QuestTemplate {
  exploration: [
    "Journey {distance} miles {direction} (DC {dc} Navigation check)",
    "Discover {1d7} hidden locations within {radius} (DC {dc} Investigation)",
    "Scout {area_type} for {2d7} minutes (DC {dc} Perception)"
  ];
  combat: [
    "Defeat {1d7+level} {enemy_type} (CR {playerLevel})",
    "Survive {2d7} waves of enemies (DC {dc} per wave)",
    "Hunt the {boss_name} (CR {playerLevel+2}, DC {dc+1})"
  ];
  collection: [
    "Gather {3d7} {resource} (DC {dc} per resource)",
    "Find {1d7} rare {item_type} (DC {dc} Investigation)",
    "Trade for {2d7} {goods} (DC {dc} Negotiation)"
  ];
  social: [
    "Form party with {1d7} adventurers (DC {dc} Persuasion)",
    "Share knowledge with {2d7} players (DC {dc} Teaching)",
    "Complete group challenge (DC {dc} Teamwork)"
  ];
}
```

### Behavioral Adaptation
- Track player's D7 roll success rate
- Adjust quest DCs ±1 based on performance
- Offer advantage on quests after 3 failures
- Increase rewards after consecutive successes

## Testing Requirements
- Quest generation with proper D7 DCs
- Distance-to-difficulty mapping validation
- XP calculation tests (base * 7 * multiplier)
- D7 loot roll distribution (14.3% per face)
- Progress tracking validation
- Chain difficulty escalation tests
- Behavioral adaptation algorithms
- Offline functionality tests
- Template variable substitution

## Acceptance Criteria
1. Quests generate with appropriate D7 DCs (2-7)
2. Distance correlates to difficulty correctly
3. XP rewards follow 7x multiplier system
4. Loot rolls use D7 probability (14.3% per outcome)
5. Progress tracked offline with state persistence
6. Quest chains escalate difficulty progressively
7. Templates produce varied content with D7 mechanics
8. Behavioral adaptation adjusts difficulty ±1 DC
9. Critical successes (7) grant bonus objectives

## Rotation Plan
- Extract quest templates to content
- Generation algorithm to ADR
- Archive after implementation
- Tests validate generation

---
*Created: 2024-12-07*
*Updated: 2025-01-08*
*Estimated effort: 3 days*