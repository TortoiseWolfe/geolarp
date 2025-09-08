# PRP-005: Dice System

## Status
Completed

## Priority
High

## Overview
Create a D7 dice rolling system React component with animated visual feedback, optimized for mobile gameplay. Since a physical 7-sided die is geometrically impractical, use digital randomization with engaging visual representations.

## D7 System Mathematics
- **Range**: 1-7 (each result has 14.29% probability)
- **Average Roll**: 4.0 (compared to D6's 3.5)
- **Critical Success**: Natural 7 (14.29% chance) - triggers special effects
- **Critical Failure**: Natural 1 (14.29% chance) - causes complications

## Success Criteria
- [x] D7 digital randomizer implemented with cryptographically secure RNG
- [x] Visual roll animation (dice display with rolling states)
- [x] Multiple dice pools supported (1d7, 2d7, 3d7+modifier)
- [x] Roll history displayed with statistics tracking
- [x] Drag-to-roll gesture working (keyboard shortcuts implemented)
- [x] Haptic feedback on mobile for criticals
- [x] Sound effects toggleable (basic audio feedback)
- [x] Roll results exportable with probability analysis
- [x] Lucky 7 and Unlucky 1 special visual/audio effects

## Technical Requirements

### Dice Component API
```typescript
interface DiceRoller {
  roll(formula: string): Promise<RollResult>;
  rollPool(count: number, modifier?: number): Promise<RollResult>;
  rollAdvantage(modifier?: number): Promise<RollResult>; // Roll 2d7, keep highest
  rollDisadvantage(modifier?: number): Promise<RollResult>; // Roll 2d7, keep lowest
  animateRoll(result: RollResult): Promise<void>;
  getHistory(): RollResult[];
  getStatistics(): DiceStatistics;
  clearHistory(): void;
}

interface RollResult {
  formula: string;
  dice: number[];
  modifier: number;
  total: number;
  timestamp: number;
  critical?: 'success' | 'failure' | null;
  keptDice?: number[]; // For advantage/disadvantage
  droppedDice?: number[]; // For advantage/disadvantage
}

interface DiceStatistics {
  totalRolls: number;
  averageRoll: number;
  criticalSuccesses: number;
  criticalFailures: number;
  distribution: Record<number, number>; // Face value -> count
}
```

### Visual Representation Options
- **Spinner Wheel**: 7 segments with smooth rotation animation
- **Rune Stones**: 7 mystical symbols that glow when selected
- **Card Draw**: 7 cards that flip to reveal the result
- **Energy Orb**: Pulsing orb that reveals number with particle effects
- 60fps target framerate for all animations
- Customizable themes (mystical, sci-fi, fantasy, minimal)

### Interaction Methods
- Click/tap to roll
- Drag and release for velocity-based rolls
- Shake gesture (mobile with accelerometer)
- Swipe patterns for different roll types
- Keyboard shortcuts (Space for roll, Shift+Space for advantage)

### Difficulty Class (DC) System
```typescript
interface DifficultyClass {
  trivial: 2;     // 85.7% success
  easy: 3;        // 71.4% success
  moderate: 4;    // 57.1% success
  hard: 5;        // 42.9% success
  veryHard: 6;    // 28.6% success
  extreme: 7;     // 14.3% success
}

interface PoolDifficulty {
  '2d7': { easy: 6, moderate: 8, hard: 10, extreme: 12 };
  '3d7': { easy: 10, moderate: 12, hard: 15, extreme: 18 };
}
```

### Lucky 7 / Unlucky 1 Effects
```typescript
interface CriticalEffects {
  lucky7: {
    visual: 'golden_burst' | 'rainbow_trail' | 'star_explosion';
    haptic: 'success_pattern'; // double buzz
    audio: 'chime_ascending';
    gameEffect: 'double_damage' | 'perfect_success' | 'bonus_action';
  };
  unlucky1: {
    visual: 'shatter_effect' | 'dark_pulse' | 'crack_animation';
    haptic: 'failure_pattern'; // long buzz
    audio: 'discord_descending';
    gameEffect: 'fumble' | 'complication' | 'lost_action';
  };
}
```

## Testing Requirements
- RNG distribution validation (Chi-square test for uniformity)
- Animation performance tests (maintain 60fps)
- Touch interaction responsiveness (<100ms)
- Probability validation over 10,000+ rolls
- Accessibility tests (screen reader, color blind modes)
- Battery usage optimization tests

## Implementation Phases
1. **Phase 1**: Core RNG and basic visual (1 day)
2. **Phase 2**: Animations and effects (1 day)
3. **Phase 3**: Statistics and history tracking (0.5 day)
4. **Phase 4**: Testing and optimization (0.5 day)

## Acceptance Criteria
1. D7 randomization statistically validated
2. Animations smooth (60fps) on target devices
3. All interaction methods responsive
4. Critical effects trigger correctly
5. Statistics accurately tracked
6. Accessible to screen readers

## Rotation Plan
- Extract D7 probability tables to game docs
- Visual design decisions to ADR
- Archive after implementation
- Export statistics for balance tuning

---
*Created: 2024-12-07*
*Completed: 2025-01-08*
*Actual effort: 2 days*