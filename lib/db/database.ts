import Dexie, { Table } from 'dexie';
import { 
  MapTile, 
  Character, 
  GameState, 
  Encounter,
  ExportBundle 
} from './types';
import { 
  validateCharacter, 
  validateGameState, 
  validateEncounter, 
  validateMapTile,
  validateExportBundle,
  sanitizeString 
} from './validators';

export class GeoLARPDatabase extends Dexie {
  mapTiles!: Table<MapTile, string>;
  characters!: Table<Character, string>;
  gameState!: Table<GameState, string>;
  encounters!: Table<Encounter, string>;

  constructor() {
    super('GeoLARPDatabase');
    
    this.version(1).stores({
      mapTiles: 'id, [x+y+zoom], timestamp',
      characters: 'id, name, updatedAt',
      gameState: 'id, lastPlayed',
      encounters: 'id, [coordinates.lat+coordinates.lng], type, discovered'
    });
  }

  async saveCharacter(character: Character): Promise<void> {
    // Validate character data
    const validation = validateCharacter(character);
    if (!validation.valid) {
      throw new Error(`Invalid character data: ${validation.errors.join(', ')}`);
    }
    
    // Sanitize string fields
    character.name = sanitizeString(character.name, 50);
    
    character.updatedAt = Date.now();
    character.version = (character.version || 0) + 1;
    await this.characters.put(character);
  }

  async loadCharacter(id: string): Promise<Character | undefined> {
    return await this.characters.get(id);
  }

  async getAllCharacters(): Promise<Character[]> {
    return await this.characters.toArray();
  }

  async cacheTile(tile: MapTile): Promise<void> {
    // Validate tile data
    const validation = validateMapTile(tile);
    if (!validation.valid) {
      throw new Error(`Invalid map tile: ${validation.errors.join(', ')}`);
    }
    
    tile.timestamp = Date.now();
    await this.mapTiles.put(tile);
  }

  async getTile(x: number, y: number, zoom: number): Promise<Blob | undefined> {
    const id = `${x},${y},${zoom}`;
    const tile = await this.mapTiles.get(id);
    return tile?.blob;
  }

  async saveGameState(state: GameState): Promise<void> {
    // Validate game state
    const validation = validateGameState(state);
    if (!validation.valid) {
      throw new Error(`Invalid game state: ${validation.errors.join(', ')}`);
    }
    
    state.lastPlayed = Date.now();
    state.statistics.lastUpdated = Date.now();
    await this.gameState.put(state);
  }

  async loadGameState(): Promise<GameState | undefined> {
    const states = await this.gameState.toArray();
    return states[0];
  }

  async saveEncounter(encounter: Encounter): Promise<void> {
    // Validate encounter data
    const validation = validateEncounter(encounter);
    if (!validation.valid) {
      throw new Error(`Invalid encounter: ${validation.errors.join(', ')}`);
    }
    
    // Sanitize string fields
    encounter.name = sanitizeString(encounter.name, 50);
    encounter.description = sanitizeString(encounter.description, 500);
    
    await this.encounters.put(encounter);
  }

  async getEncountersByArea(
    center: { lat: number; lng: number },
    radiusKm: number
  ): Promise<Encounter[]> {
    const allEncounters = await this.encounters.toArray();
    
    return allEncounters.filter(encounter => {
      const distance = this.calculateDistance(
        center.lat,
        center.lng,
        encounter.coordinates.lat,
        encounter.coordinates.lng
      );
      return distance <= radiusKm;
    });
  }

  async clearOldTiles(daysOld: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    await this.mapTiles
      .where('timestamp')
      .below(cutoffTime)
      .delete();
  }

  async exportData(): Promise<ExportBundle> {
    const characters = await this.characters.toArray();
    const gameState = await this.loadGameState();
    const encounters = await this.encounters.toArray();
    const achievements = gameState?.achievements || [];

    return {
      version: '1.0.0',
      exportDate: Date.now(),
      characters,
      gameState: gameState!,
      encounters,
      achievements
    };
  }

  async importData(bundle: ExportBundle): Promise<void> {
    // Validate entire bundle structure
    const validation = validateExportBundle(bundle);
    if (!validation.valid) {
      throw new Error(`Invalid import data: ${validation.errors.slice(0, 5).join(', ')}`);
    }
    
    await this.transaction('rw', this.characters, this.gameState, this.encounters, async () => {
      // Import characters with validation
      for (const character of bundle.characters) {
        const charValidation = validateCharacter(character);
        if (charValidation.valid) {
          // Sanitize before storing
          character.name = sanitizeString(character.name, 50);
          await this.characters.put(character);
        }
      }
      
      // Import game state with validation
      if (bundle.gameState) {
        const stateValidation = validateGameState(bundle.gameState);
        if (stateValidation.valid) {
          await this.gameState.put(bundle.gameState);
        }
      }
      
      // Import encounters with validation
      for (const encounter of bundle.encounters) {
        const encValidation = validateEncounter(encounter);
        if (encValidation.valid) {
          // Sanitize before storing
          encounter.name = sanitizeString(encounter.name, 50);
          encounter.description = sanitizeString(encounter.description, 500);
          await this.encounters.put(encounter);
        }
      }
    });
  }

  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.mapTiles, this.characters, this.gameState, this.encounters, async () => {
      await this.mapTiles.clear();
      await this.characters.clear();
      await this.gameState.clear();
      await this.encounters.clear();
    });
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const db = new GeoLARPDatabase();