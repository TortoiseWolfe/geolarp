# PRP-013: Game State Management

## Status
Active

## Priority
High

## Overview
Create a Zustand store for centralized game state management with automatic persistence, migrations, TypeScript support, and comprehensive D7 statistics tracking for game balance analysis.

## Success Criteria
- [ ] Zustand store configured with D7 mechanics
- [ ] Automatic LocalStorage persistence
- [ ] State migrations working
- [ ] TypeScript types complete for D7 system
- [ ] All game actions with D7 rolls implemented
- [ ] D7 statistics tracking (distribution, criticals)
- [ ] Roll history with advantage/disadvantage tracking
- [ ] Undo/redo for critical actions
- [ ] Optimistic updates working
- [ ] Conflict resolution handled
- [ ] Dev tools integrated with D7 debugging

## Technical Requirements

### Store Structure
```typescript
interface GameStore {
  // Character State
  character: Character | null;
  setCharacter: (character: Character) => void;
  updateCharacter: (updates: Partial<Character>) => void;
  
  // D7 Dice State
  rollHistory: RollResult[];
  diceStatistics: D7Statistics;
  rollD7: (count?: number, modifier?: number) => RollResult;
  rollAdvantage: (modifier?: number) => RollResult;
  rollDisadvantage: (modifier?: number) => RollResult;
  rollSkillCheck: (dc: number, modifier?: number) => CheckResult;
  
  // Game State
  currentQuest: Quest | null;
  questDifficulty: number;      // Current quest DC (2-7)
  encounters: Encounter[];
  inventory: Item[];
  
  // Location State
  position: Coordinates;
  environmentModifier: number;  // -1 to +2 based on location
  updatePosition: (coords: Coordinates) => void;
  
  // Combat State
  inCombat: boolean;
  combatLog: CombatEvent[];
  initiativeOrder: Combatant[];
  
  // Settings
  settings: GameSettings;
  updateSettings: (settings: Partial<GameSettings>) => void;
  
  // Actions
  completeQuest: (questId: string, rollResult: number) => void;
  addItem: (item: Item, lootRoll?: number) => void;
  gainXP: (amount: number) => void;  // Uses 7x multiplier
  
  // Statistics Tracking
  updateD7Stats: (result: RollResult) => void;
  getSuccessRate: () => number;
  getCriticalRate: () => { success: number; failure: number };
  
  // Persistence
  save: () => void;
  load: () => void;
  reset: () => void;
  migrate: (oldVersion: number) => void;
}

interface D7Statistics {
  totalRolls: number;
  distribution: Record<1|2|3|4|5|6|7, number>;
  averageRoll: number;
  criticalSuccesses: number;  // Natural 7s
  criticalFailures: number;   // Natural 1s
  advantageRolls: number;
  disadvantageRolls: number;
  successfulChecks: number;
  failedChecks: number;
  streaks: {
    currentLucky: number;     // Consecutive 6-7 rolls
    currentUnlucky: number;   // Consecutive 1-2 rolls
    bestLucky: number;
    worstUnlucky: number;
  };
}

interface CheckResult {
  success: boolean;
  roll: number;
  modifier: number;
  dc: number;
  critical: 'success' | 'failure' | null;
  margin: number;  // How much over/under DC
}
```

### Persistence Layer
```typescript
interface PersistenceConfig {
  autoSaveInterval: 30000;     // 30 seconds
  maxRollHistory: 100;         // Keep last 100 rolls
  compressionThreshold: 50000; // Compress if > 50KB
  version: number;              // Current schema version
}

// Auto-save triggers
- Every 30 seconds
- After D7 rolls (batched)
- On quest completion
- On level up (XP threshold crossed)
- On critical success/failure
- Before app background/close

// Migration strategy
interface Migration {
  from: number;
  to: number;
  migrate: (oldState: any) => any;
}

// D7-specific saves
- Roll statistics aggregated hourly
- Daily statistics summary
- Achievement unlocks (Lucky 7 streak, etc.)
```

### Performance Optimizations
- Debounce D7 statistics updates (100ms)
- Batch roll history updates
- Lazy load encounter data
- Compress old combat logs
- Selective component subscriptions

## Testing Requirements
- State update tests with D7 mechanics
- D7 roll distribution validation (14.3% per face)
- Critical success/failure tracking accuracy
- XP calculation tests (7x multiplier)
- Advantage/disadvantage roll verification
- Persistence tests with statistics
- Migration tests for D7 data structures
- Performance tests with large roll histories
- Conflict resolution tests
- Statistics accuracy over 10,000+ rolls

## Acceptance Criteria
1. All game state centralized in Zustand
2. D7 mechanics fully integrated
3. Roll statistics accurately tracked
4. Critical rates match expected 14.3%
5. Persistence working with compression
6. Migrations handle D7 data structures
7. TypeScript enforced for D7 types
8. Dev tools show D7 statistics
9. Performance maintained with history
10. Behavioral adaptation data tracked

## Rotation Plan
- State architecture to ADR
- Migration strategy documented
- Archive after implementation
- Tests validate state logic

---
*Created: 2024-12-07*
*Updated: 2025-01-08*
*Estimated effort: 3 days*