export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapTile {
  id: string; // "x,y,zoom"
  x: number;
  y: number;
  zoom: number;
  blob: Blob;
  timestamp: number;
}

export interface Attributes {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc';
  quantity: number;
  equipped?: boolean;
  properties?: Record<string, any>;
}

export interface Character {
  id: string;
  name: string;
  level: number;
  experience: number;
  attributes: Attributes;
  inventory: Item[];
  position: Coordinates;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  status: 'active' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
}

export interface QuestObjective {
  id: string;
  description: string;
  completed: boolean;
  progress?: number;
  target?: number;
}

export interface QuestReward {
  type: 'experience' | 'item' | 'currency';
  amount: number;
  itemId?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: number;
  icon?: string;
}

export interface Statistics {
  totalPlayTime: number;
  distanceTraveled: number;
  encountersCompleted: number;
  questsCompleted: number;
  achievementsUnlocked: number;
  lastUpdated: number;
}

export interface GameState {
  id: string;
  currentQuest?: Quest;
  activeQuests: Quest[];
  completedQuests: string[];
  achievements: Achievement[];
  statistics: Statistics;
  lastPlayed: number;
  settings: GameSettings;
}

export interface GameSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
  mapStyle: 'street' | 'satellite' | 'terrain';
  language: string;
}

export type EncounterType = 'battle' | 'treasure' | 'npc' | 'landmark' | 'puzzle';

export interface Encounter {
  id: string;
  coordinates: Coordinates;
  type: EncounterType;
  name: string;
  description: string;
  discovered: boolean;
  completedAt?: number;
  respawnTime?: number;
  rewards?: QuestReward[];
  difficulty?: number;
}

export interface ExportBundle {
  version: string;
  exportDate: number;
  characters: Character[];
  gameState: GameState;
  encounters: Encounter[];
  achievements: Achievement[];
}