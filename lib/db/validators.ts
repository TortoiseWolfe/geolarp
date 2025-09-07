import { 
  Character, 
  GameState, 
  Encounter, 
  MapTile,
  ExportBundle,
  Attributes,
  Item,
  Quest,
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
export function isValidCoordinates(coords: any): coords is Coordinates {
  return coords &&
    typeof coords.lat === 'number' &&
    typeof coords.lng === 'number' &&
    coords.lat >= -90 && coords.lat <= 90 &&
    coords.lng >= -180 && coords.lng <= 180;
}

export function isValidAttributes(attrs: any): attrs is Attributes {
  if (!attrs || typeof attrs !== 'object') return false;
  
  const requiredAttrs = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  
  for (const attr of requiredAttrs) {
    if (typeof attrs[attr] !== 'number' || 
        attrs[attr] < MIN_ATTRIBUTE || 
        attrs[attr] > MAX_ATTRIBUTE) {
      return false;
    }
  }
  
  return true;
}

export function isValidItem(item: any): item is Item {
  return item &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    item.name.length <= MAX_NAME_LENGTH &&
    VALID_ITEM_TYPES.includes(item.type) &&
    typeof item.quantity === 'number' &&
    item.quantity >= 0;
}

export function validateCharacter(character: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!character || typeof character !== 'object') {
    errors.push('Character must be an object');
    return { valid: false, errors };
  }
  
  // Validate ID
  if (!character.id || typeof character.id !== 'string') {
    errors.push('Character must have a valid ID');
  }
  
  // Validate name
  if (!character.name || typeof character.name !== 'string') {
    errors.push('Character must have a name');
  } else if (character.name.length > MAX_NAME_LENGTH) {
    errors.push(`Character name must be ${MAX_NAME_LENGTH} characters or less`);
  }
  
  // Validate level
  if (typeof character.level !== 'number' || 
      character.level < MIN_LEVEL || 
      character.level > MAX_LEVEL) {
    errors.push(`Character level must be between ${MIN_LEVEL} and ${MAX_LEVEL}`);
  }
  
  // Validate experience
  if (typeof character.experience !== 'number' || character.experience < 0) {
    errors.push('Character experience must be a positive number');
  }
  
  // Validate attributes
  if (!isValidAttributes(character.attributes)) {
    errors.push('Character must have valid attributes');
  }
  
  // Validate inventory
  if (!Array.isArray(character.inventory)) {
    errors.push('Character inventory must be an array');
  } else {
    for (let i = 0; i < character.inventory.length; i++) {
      if (!isValidItem(character.inventory[i])) {
        errors.push(`Invalid item at inventory position ${i}`);
      }
    }
  }
  
  // Validate position
  if (!isValidCoordinates(character.position)) {
    errors.push('Character must have a valid position');
  }
  
  // Validate timestamps
  if (typeof character.createdAt !== 'number' || character.createdAt < 0) {
    errors.push('Character must have a valid creation timestamp');
  }
  
  if (typeof character.updatedAt !== 'number' || character.updatedAt < 0) {
    errors.push('Character must have a valid update timestamp');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateGameState(gameState: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!gameState || typeof gameState !== 'object') {
    errors.push('Game state must be an object');
    return { valid: false, errors };
  }
  
  // Validate ID
  if (!gameState.id || typeof gameState.id !== 'string') {
    errors.push('Game state must have a valid ID');
  }
  
  // Validate arrays
  if (!Array.isArray(gameState.activeQuests)) {
    errors.push('Active quests must be an array');
  }
  
  if (!Array.isArray(gameState.completedQuests)) {
    errors.push('Completed quests must be an array');
  }
  
  if (!Array.isArray(gameState.achievements)) {
    errors.push('Achievements must be an array');
  }
  
  // Validate statistics
  if (!gameState.statistics || typeof gameState.statistics !== 'object') {
    errors.push('Game state must have statistics');
  } else {
    const stats = gameState.statistics;
    if (typeof stats.totalPlayTime !== 'number' || stats.totalPlayTime < 0) {
      errors.push('Total play time must be a positive number');
    }
    if (typeof stats.distanceTraveled !== 'number' || stats.distanceTraveled < 0) {
      errors.push('Distance traveled must be a positive number');
    }
  }
  
  // Validate settings
  if (!gameState.settings || typeof gameState.settings !== 'object') {
    errors.push('Game state must have settings');
  } else {
    const settings = gameState.settings;
    if (typeof settings.soundEnabled !== 'boolean') {
      errors.push('Sound enabled must be a boolean');
    }
    if (!VALID_DIFFICULTIES.includes(settings.difficulty)) {
      errors.push('Invalid difficulty setting');
    }
    if (!VALID_MAP_STYLES.includes(settings.mapStyle)) {
      errors.push('Invalid map style');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateEncounter(encounter: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!encounter || typeof encounter !== 'object') {
    errors.push('Encounter must be an object');
    return { valid: false, errors };
  }
  
  // Validate ID
  if (!encounter.id || typeof encounter.id !== 'string') {
    errors.push('Encounter must have a valid ID');
  }
  
  // Validate coordinates
  if (!isValidCoordinates(encounter.coordinates)) {
    errors.push('Encounter must have valid coordinates');
  }
  
  // Validate type
  const validTypes = ['battle', 'treasure', 'npc', 'landmark', 'puzzle'];
  if (!validTypes.includes(encounter.type)) {
    errors.push('Invalid encounter type');
  }
  
  // Validate name and description
  if (!encounter.name || typeof encounter.name !== 'string' || 
      encounter.name.length > MAX_NAME_LENGTH) {
    errors.push('Encounter must have a valid name');
  }
  
  if (!encounter.description || typeof encounter.description !== 'string' || 
      encounter.description.length > MAX_STRING_LENGTH) {
    errors.push('Encounter must have a valid description');
  }
  
  // Validate discovered flag
  if (typeof encounter.discovered !== 'boolean') {
    errors.push('Discovered must be a boolean');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateMapTile(tile: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!tile || typeof tile !== 'object') {
    errors.push('Map tile must be an object');
    return { valid: false, errors };
  }
  
  // Validate coordinates
  if (typeof tile.x !== 'number' || typeof tile.y !== 'number' || 
      typeof tile.zoom !== 'number') {
    errors.push('Map tile must have valid x, y, and zoom values');
  }
  
  // Validate zoom level
  if (tile.zoom < 0 || tile.zoom > 22) {
    errors.push('Zoom level must be between 0 and 22');
  }
  
  // Validate blob
  if (!(tile.blob instanceof Blob)) {
    errors.push('Map tile must have a valid blob');
  }
  
  // Validate timestamp
  if (typeof tile.timestamp !== 'number' || tile.timestamp < 0) {
    errors.push('Map tile must have a valid timestamp');
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateExportBundle(bundle: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!bundle || typeof bundle !== 'object') {
    errors.push('Export bundle must be an object');
    return { valid: false, errors };
  }
  
  // Validate version
  if (!bundle.version || typeof bundle.version !== 'string') {
    errors.push('Export bundle must have a version');
  }
  
  // Validate export date
  if (typeof bundle.exportDate !== 'number' || bundle.exportDate < 0) {
    errors.push('Export bundle must have a valid export date');
  }
  
  // Validate characters array
  if (!Array.isArray(bundle.characters)) {
    errors.push('Export bundle must have a characters array');
  } else {
    for (let i = 0; i < bundle.characters.length; i++) {
      const charValidation = validateCharacter(bundle.characters[i]);
      if (!charValidation.valid) {
        errors.push(`Character ${i}: ${charValidation.errors.join(', ')}`);
      }
    }
  }
  
  // Validate game state
  if (bundle.gameState) {
    const stateValidation = validateGameState(bundle.gameState);
    if (!stateValidation.valid) {
      errors.push(`Game state: ${stateValidation.errors.join(', ')}`);
    }
  }
  
  // Validate encounters array
  if (!Array.isArray(bundle.encounters)) {
    errors.push('Export bundle must have an encounters array');
  } else {
    for (let i = 0; i < bundle.encounters.length; i++) {
      const encValidation = validateEncounter(bundle.encounters[i]);
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