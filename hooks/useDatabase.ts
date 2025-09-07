'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db/database';
import { storageManager } from '@/lib/db/storage-manager';
import { 
  Character, 
  GameState, 
  Encounter,
  MapTile,
  ExportBundle 
} from '@/lib/db/types';

export function useCharacter(characterId?: string) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!characterId) {
      setLoading(false);
      return;
    }

    const loadCharacter = async () => {
      try {
        setLoading(true);
        const char = await db.loadCharacter(characterId);
        setCharacter(char || null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadCharacter();
  }, [characterId]);

  const saveCharacter = useCallback(async (char: Character) => {
    try {
      await db.saveCharacter(char);
      setCharacter(char);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return { character, loading, error, saveCharacter };
}

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadCharacters = useCallback(async () => {
    try {
      setLoading(true);
      const chars = await db.getAllCharacters();
      setCharacters(chars);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  return { characters, loading, error, refetch: loadCharacters };
}

export function useGameState() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadGameState = async () => {
      try {
        setLoading(true);
        const state = await db.loadGameState();
        setGameState(state || null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadGameState();
  }, []);

  const saveGameState = useCallback(async (state: GameState) => {
    try {
      await db.saveGameState(state);
      setGameState(state);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return { gameState, loading, error, saveGameState };
}

export function useEncounters(center?: { lat: number; lng: number }, radiusKm: number = 1) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!center) {
      setLoading(false);
      return;
    }

    const loadEncounters = async () => {
      try {
        setLoading(true);
        const enc = await db.getEncountersByArea(center, radiusKm);
        setEncounters(enc);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadEncounters();
  }, [center?.lat, center?.lng, radiusKm]);

  const saveEncounter = useCallback(async (encounter: Encounter) => {
    try {
      await db.saveEncounter(encounter);
      // Refresh encounters list
      if (center) {
        const enc = await db.getEncountersByArea(center, radiusKm);
        setEncounters(enc);
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [center, radiusKm]);

  return { encounters, loading, error, saveEncounter };
}

export function useMapTiles() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cacheTile = useCallback(async (tile: MapTile) => {
    try {
      setLoading(true);
      await db.cacheTile(tile);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTile = useCallback(async (x: number, y: number, zoom: number) => {
    try {
      setLoading(true);
      return await db.getTile(x, y, zoom);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { cacheTile, getTile, loading, error };
}

export function useDataExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportData = useCallback(async () => {
    try {
      setLoading(true);
      const bundle = await db.exportData();
      
      // Create a downloadable file
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `geolarp-export-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return bundle;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const importData = useCallback(async (file: File) => {
    try {
      setLoading(true);
      const text = await file.text();
      const bundle: ExportBundle = JSON.parse(text);
      await db.importData(bundle);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { exportData, importData, loading, error };
}

export function useStorageManager() {
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initStorageMonitoring = async () => {
      try {
        setLoading(true);
        
        // Set up monitoring (this will also do the initial check)
        cleanup = await storageManager.monitorStorage((stats) => {
          setStorageInfo(stats);
          setLoading(false);
        }, 60000); // Check every minute
      } catch (err) {
        console.error('Error initializing storage monitoring:', err);
        setError(err as Error);
        setLoading(false);
      }
    };

    initStorageMonitoring();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const requestPersistentStorage = useCallback(async () => {
    try {
      const granted = await storageManager.requestPersistentStorage();
      if (granted && storageInfo) {
        setStorageInfo({ ...storageInfo, isPersistent: true });
      }
      return granted;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [storageInfo]);

  const performCleanup = useCallback(async () => {
    try {
      await storageManager.performCleanup();
      // Refresh storage info
      const quota = await storageManager.checkStorageQuota();
      const stats = await storageManager.getStorageStats();
      const isPersistent = await storageManager.checkPersistentStorage();
      
      setStorageInfo({
        ...quota,
        ...stats,
        isPersistent,
        formattedUsage: storageManager.formatBytes(quota.usage),
        formattedQuota: storageManager.formatBytes(quota.quota)
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return { 
    storageInfo, 
    loading, 
    error, 
    requestPersistentStorage,
    performCleanup 
  };
}