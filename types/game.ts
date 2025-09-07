export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GridCell {
  x: number;
  y: number;
}

export enum EncounterType {
  MONSTER = 'monster',
  NPC = 'npc',
  TREASURE = 'treasure',
  SHRINE = 'shrine',
  TRAP = 'trap'
}

export interface Encounter {
  id: string;
  type: EncounterType;
  coordinates: GridCell;
  level: number;
  discovered: boolean;
  respawnTime?: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: Objective[];
  rewards: Reward[];
  progress: number;
  completed: boolean;
}

export interface Objective {
  id: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
}

export interface Reward {
  type: 'xp' | 'item' | 'currency';
  amount: number;
  itemId?: string;
}