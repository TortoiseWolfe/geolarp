export interface RollResult {
  formula: string;
  dice: number[];
  modifier: number;
  total: number;
  timestamp: number;
  critical?: boolean;
  fumble?: boolean;
  id: string;
}

export interface DiceRoller {
  roll(formula: string): Promise<RollResult>;
  rollPool(count: number, modifier?: number): Promise<RollResult>;
  animateRoll(result: RollResult): Promise<void>;
  getHistory(): RollResult[];
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