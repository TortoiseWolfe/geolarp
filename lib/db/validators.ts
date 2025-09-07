import { 
  Attributes,
  Item,
  Coordinates
} from './types';

// Constants for validation
const MAX_NAME_LENGTH = 50;
const MAX_STRING_LENGTH = 500;
const MAX_LEVEL = 100;
const MIN_LEVEL = 1;
const MAX_ATTRIBUTE = 100;
const MIN_ATTRIBUTE = 1;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_ITEM_TYPES = ['weapon', 'armor', 'consumable', 'quest', 'misc'] as const;
const VALID_DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
const VALID_MAP_STYLES = ['street', 'satellite', 'terrain'] as const;

// Sanitization functions
export function sanitizeString(input: string, maxLength: number = MAX_STRING_LENGTH): string {
  if (typeof input !== 'string') return '';
  // Remove HTML tags and limit length
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, maxLength);
}

export function sanitizeDisplayName(name: string): string {
  return sanitizeString(name, MAX_NAME_LENGTH);
}

// Validation functions
export function isValidCoordinates(coords: unknown): coords is Coordinates {
  const c = coords as Record<string, unknown>;
  return c &&
    typeof c.lat === 'number' &&
    typeof c.lng === 'number' &&
    c.lat >= -90 && c.lat <= 90 &&
    c.lng >= -180 && c.lng <= 180;
}

export function isValidAttributes(attrs: unknown): attrs is Attributes {
  if (!attrs || typeof attrs !== 'object') return false;
  
  const a = attrs as Record<string, unknown>;
  const requiredAttrs = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  
  for (const attr of requiredAttrs) {
    const value = a[attr];
    if (typeof value !== 'number' || 
        value < MIN_ATTRIBUTE || 
        value > MAX_ATTRIBUTE) {
      return false;
    }
  }
  
  return true;
}

export function isValidItem(item: unknown): item is Item {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, unknown>;
  return typeof i.id === 'string' &&
    typeof i.name === 'string' &&
    (i.name as string).length <= MAX_NAME_LENGTH &&
    VALID_ITEM_TYPES.includes(i.type as typeof VALID_ITEM_TYPES[number]) &&
    typeof i.quantity === 'number' &&
    i.quantity >= 0;
}

export function validateCharacter(character: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!character || typeof character !== 'object') {
    errors.push('Character must be an object');
    return { valid: false, errors };
  }
  
  const char = character as Record<string, unknown>;
  
  // Validate ID
  if (!char.id || typeof char.id !== 'string') {
    errors.push('Character must have a valid ID');
  }
  
  // Validate name
  if (!char.name || typeof char.name !== 'string') {
    errors.push('Character must have a name');
  } else if ((char.name as string).length > MAX_NAME_LENGTH) {
    errors.push(`Character name must be ${MAX_NAME_LENGTH} characters or less`);
  }
  
  // Validate level
  if (typeof char.level !== 'number' || 
      char.level < MIN_LEVEL || 
      char.level > MAX_LEVEL) {
    errors.push(`Character level must be between ${MIN_LEVEL} and ${MAX_LEVEL}`);
  }
  
  // Validate experience
  if (typeof char.experience !== 'number' || char.experience < 0) {
    errors.push('Character experience must be a positive number');
  }
  
  // Validate attributes
  if (!isValidAttributes(char.attributes)) {
    errors.push('Character must have valid attributes');
  }
  
  // Validate inventory
  if (!Array.isArray(char.inventory)) {
    errors.push('Character inventory must be an array');
  } else {
    const inventory = char.inventory as unknown[];
    for (let i = 0; i < inventory.length; i++) {
      if (!isValidItem(inventory[i])) {
        errors.push(`Invalid item at inventory position ${i}`);
      }
    }
  }
  
  // Validate position
  if (!isValidCoordinates(char.position)) {
    errors.push('Character must have a valid position');
  }
  
  // Validate timestamps
  if (typeof char.createdAt !== 'number' || char.createdAt < 0) {
    errors.push('Character must have a valid creation timestamp');
  }
  
  if (typeof char.updatedAt !== 'number' || char.updatedAt < 0) {
    errors.push('Character must have a valid update timestamp');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateGameState(gameState: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!gameState || typeof gameState !== 'object') {
    errors.push('Game state must be an object');
    return { valid: false, errors };
  }
  
  const gs = gameState as Record<string, unknown>;
  
  // Validate ID
  if (!gs.id || typeof gs.id !== 'string') {
    errors.push('Game state must have a valid ID');
  }
  
  // Validate arrays
  if (!Array.isArray(gs.activeQuests)) {
    errors.push('Active quests must be an array');
  }
  
  if (!Array.isArray(gs.completedQuests)) {
    errors.push('Completed quests must be an array');
  }
  
  if (!Array.isArray(gs.achievements)) {
    errors.push('Achievements must be an array');
  }
  
  // Validate statistics
  if (!gs.statistics || typeof gs.statistics !== 'object') {
    errors.push('Game state must have statistics');
  } else {
    const stats = gs.statistics as Record<string, unknown>;
    if (typeof stats.totalPlayTime !== 'number' || stats.totalPlayTime < 0) {
      errors.push('Total play time must be a positive number');
    }
    if (typeof stats.distanceTraveled !== 'number' || stats.distanceTraveled < 0) {
      errors.push('Distance traveled must be a positive number');
    }
  }
  
  // Validate settings
  if (!gs.settings || typeof gs.settings !== 'object') {
    errors.push('Game state must have settings');
  } else {
    const settings = gs.settings as Record<string, unknown>;
    if (typeof settings.soundEnabled !== 'boolean') {
      errors.push('Sound enabled must be a boolean');
    }
    if (!VALID_DIFFICULTIES.includes(settings.difficulty as typeof VALID_DIFFICULTIES[number])) {
      errors.push('Invalid difficulty setting');
    }
    if (!VALID_MAP_STYLES.includes(settings.mapStyle as typeof VALID_MAP_STYLES[number])) {
      errors.push('Invalid map style');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateEncounter(encounter: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!encounter || typeof encounter !== 'object') {
    errors.push('Encounter must be an object');
    return { valid: false, errors };
  }
  
  const enc = encounter as Record<string, unknown>;
  
  // Validate ID
  if (!enc.id || typeof enc.id !== 'string') {
    errors.push('Encounter must have a valid ID');
  }
  
  // Validate coordinates
  if (!isValidCoordinates(enc.coordinates)) {
    errors.push('Encounter must have valid coordinates');
  }
  
  // Validate type
  const validTypes = ['battle', 'treasure', 'npc', 'landmark', 'puzzle'];
  if (!validTypes.includes(enc.type as string)) {
    errors.push('Invalid encounter type');
  }
  
  // Validate name and description
  if (!enc.name || typeof enc.name !== 'string' || 
      enc.name.length > MAX_NAME_LENGTH) {
    errors.push('Encounter must have a valid name');
  }
  
  if (!enc.description || typeof enc.description !== 'string' || 
      enc.description.length > MAX_STRING_LENGTH) {
    errors.push('Encounter must have a valid description');
  }
  
  // Validate discovered flag
  if (typeof enc.discovered !== 'boolean') {
    errors.push('Discovered must be a boolean');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateMapTile(tile: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!tile || typeof tile !== 'object') {
    errors.push('Map tile must be an object');
    return { valid: false, errors };
  }
  
  const t = tile as Record<string, unknown>;
  
  // Validate coordinates
  if (typeof t.x !== 'number' || typeof t.y !== 'number' || 
      typeof t.zoom !== 'number') {
    errors.push('Map tile must have valid x, y, and zoom values');
  }
  
  // Validate zoom level
  if (typeof t.zoom === 'number' && (t.zoom < 0 || t.zoom > 22)) {
    errors.push('Zoom level must be between 0 and 22');
  }
  
  // Validate blob
  if (!(t.blob instanceof Blob)) {
    errors.push('Map tile must have a valid blob');
  }
  
  // Validate timestamp
  if (typeof t.timestamp !== 'number' || t.timestamp < 0) {
    errors.push('Map tile must have a valid timestamp');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateExportBundle(bundle: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!bundle || typeof bundle !== 'object') {
    errors.push('Export bundle must be an object');
    return { valid: false, errors };
  }
  
  const b = bundle as Record<string, unknown>;
  
  // Validate version
  if (!b.version || typeof b.version !== 'string') {
    errors.push('Export bundle must have a version');
  }
  
  // Validate export date
  if (typeof b.exportDate !== 'number' || b.exportDate < 0) {
    errors.push('Export bundle must have a valid export date');
  }
  
  // Validate characters array
  if (!Array.isArray(b.characters)) {
    errors.push('Export bundle must have a characters array');
  } else {
    for (let i = 0; i < b.characters.length; i++) {
      const charValidation = validateCharacter(b.characters[i]);
      if (!charValidation.valid) {
        errors.push(`Character ${i}: ${charValidation.errors.join(', ')}`);
      }
    }
  }
  
  // Validate game state
  if (b.gameState) {
    const stateValidation = validateGameState(b.gameState);
    if (!stateValidation.valid) {
      errors.push(`Game state: ${stateValidation.errors.join(', ')}`);
    }
  }
  
  // Validate encounters array
  if (!Array.isArray(b.encounters)) {
    errors.push('Export bundle must have an encounters array');
  } else {
    for (let i = 0; i < b.encounters.length; i++) {
      const encValidation = validateEncounter(b.encounters[i]);
      if (!encValidation.valid) {
        errors.push(`Encounter ${i}: ${encValidation.errors.join(', ')}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateFileImport(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.name.endsWith('.json')) {
    return { valid: false, error: 'File must be a JSON file' };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  
  // Check MIME type if available
  if (file.type && file.type !== 'application/json') {
    return { valid: false, error: 'File must be a valid JSON file' };
  }
  
  return { valid: true };
}