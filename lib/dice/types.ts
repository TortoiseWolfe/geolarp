export interface RollResult {
  formula: string;
  dice: number[];
  modifier: number;
  total: number;
  timestamp: number;
  critical?: 'success' | 'failure' | null;
  fumble?: boolean;
  id: string;
  keptDice?: number[];  // For advantage/disadvantage
  droppedDice?: number[];  // For advantage/disadvantage
  rollType?: 'normal' | 'advantage' | 'disadvantage';
}

export interface CheckResult {
  success: boolean;
  roll: number;
  modifier: number;
  dc: number;
  critical: 'success' | 'failure' | null;
  margin: number;  // How much over/under DC
  dice: number[];
}

export interface DiceStatistics {
  totalRolls: number;
  averageRoll: number;
  criticalSuccesses: number;
  criticalFailures: number;
  distribution: Record<number, number>;  // Face value -> count
  successfulChecks: number;
  failedChecks: number;
  advantageRolls: number;
  disadvantageRolls: number;
  streaks: {
    currentLucky: number;     // Consecutive 6-7 rolls
    currentUnlucky: number;   // Consecutive 1-2 rolls
    bestLucky: number;
    worstUnlucky: number;
  };
}

export interface DiceRoller {
  roll(formula: string): Promise<RollResult>;
  rollPool(count: number, modifier?: number): Promise<RollResult>;
  rollAdvantage(modifier?: number): Promise<RollResult>;
  rollDisadvantage(modifier?: number): Promise<RollResult>;
  rollCheck(dc: number, modifier?: number): Promise<CheckResult>;
  animateRoll(result: RollResult): Promise<void>;
  getHistory(): RollResult[];
  getStatistics(): DiceStatistics;
  clearHistory(): void;
}

export interface DiceConfig {
  enableSound: boolean;
  soundVolume: number;
  enableHaptics: boolean;
  animationSpeed: number;
  renderer: '3d' | '2d' | 'auto';
  theme: 'classic' | 'fantasy' | 'neon';
  maxHistory: number;
}

export interface D7Face {
  value: number;
  rotation: {
    x: number;
    y: number;
    z: number;
  };
}

export interface AnimationState {
  isRolling: boolean;
  progress: number;
  currentFace: number;
}

export interface DicePoolState {
  dice: DiceInstance[];
  modifier: number;
  total: number;
}

export interface DiceInstance {
  id: string;
  value: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  isRolling: boolean;
}

export interface TouchGesture {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  velocity: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

export type RollCallback = (result: RollResult) => void;
export type ErrorCallback = (error: Error) => void;

export const D7_FACES: D7Face[] = [
  { value: 1, rotation: { x: 0, y: 0, z: 0 } },
  { value: 2, rotation: { x: 90, y: 0, z: 0 } },
  { value: 3, rotation: { x: 0, y: 90, z: 0 } },
  { value: 4, rotation: { x: 0, y: -90, z: 0 } },
  { value: 5, rotation: { x: -90, y: 0, z: 0 } },
  { value: 6, rotation: { x: 180, y: 0, z: 0 } },
  { value: 7, rotation: { x: 0, y: 180, z: 0 } }
];

export const DEFAULT_CONFIG: DiceConfig = {
  enableSound: true,
  soundVolume: 0.5,
  enableHaptics: true,
  animationSpeed: 1,
  renderer: 'auto',
  theme: 'classic',
  maxHistory: 50
};

export const DIFFICULTY_CLASSES = {
  trivial: 2,     // 85.7% success
  easy: 3,        // 71.4% success
  moderate: 4,    // 57.1% success
  hard: 5,        // 42.9% success
  veryHard: 6,    // 28.6% success
  extreme: 7,     // 14.3% success
} as const;

export interface CriticalEffects {
  lucky7: {
    visual: 'golden_burst' | 'rainbow_trail' | 'star_explosion';
    haptic: 'success_pattern';  // double buzz
    audio: 'chime_ascending';
    gameEffect: 'double_damage' | 'perfect_success' | 'bonus_action';
  };
  unlucky1: {
    visual: 'shatter_effect' | 'dark_pulse' | 'crack_animation';
    haptic: 'failure_pattern';  // long buzz
    audio: 'discord_descending';
    gameEffect: 'fumble' | 'complication' | 'lost_action';
  };
}