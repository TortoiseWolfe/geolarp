import { Coordinates } from './game';

export interface Character {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  experience: number;
  attributes: Attributes;
  inventory: Item[];
  equipment: Equipment;
  position?: Coordinates;
  created: Date;
  lastPlayed: Date;
}

export enum CharacterClass {
  ROGUE = 'rogue',
  RANGER = 'ranger',
  MERCHANT = 'merchant',
  GUARDIAN = 'guardian',
  ARTIFICER = 'artificer',
  MARINER = 'mariner'
}

export interface Attributes {
  strength: number;     // 1-7
  agility: number;      // 1-7
  intellect: number;    // 1-7
  spirit: number;       // 1-7
  luck: number;         // 1-7
}

export interface Item {
  id: string;
  name: string;
  description: string;
  quantity: number;
  stackable: boolean;
  equipable: boolean;
  slot?: EquipmentSlot;
}

export interface Equipment {
  head?: Item;
  chest?: Item;
  legs?: Item;
  feet?: Item;
  mainHand?: Item;
  offHand?: Item;
  accessory1?: Item;
  accessory2?: Item;
}

export enum EquipmentSlot {
  HEAD = 'head',
  CHEST = 'chest',
  LEGS = 'legs',
  FEET = 'feet',
  MAIN_HAND = 'mainHand',
  OFF_HAND = 'offHand',
  ACCESSORY = 'accessory'
}