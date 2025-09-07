'use client';

import { useState } from 'react';
import { 
  useCharacters, 
  useGameState, 
  useStorageManager,
  useDataExport 
} from '@/hooks/useDatabase';
import { db } from '@/lib/db/database';
import { storageManager } from '@/lib/db/storage-manager';
import { Character, GameState } from '@/lib/db/types';
import { sanitizeDisplayName, validateCharacter } from '@/lib/db/validators';

export default function DatabaseDemo() {
  const { characters, loading: charsLoading, refetch: refetchCharacters } = useCharacters();
  const { gameState, saveGameState, loading: gameLoading } = useGameState();
  const { storageInfo, requestPersistentStorage, performCleanup } = useStorageManager();
  const { exportData, importData } = useDataExport();
  
  const [newCharName, setNewCharName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const createCharacter = async () => {
    if (!newCharName.trim()) {
      setError('Please enter a character name');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Sanitize input before creating character
      const sanitizedName = sanitizeDisplayName(newCharName);
      
      const character: Character = {
        id: `char-${Date.now()}`,
        name: sanitizedName,
        level: 1,
        experience: 0,
        attributes: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10
        },
        inventory: [],
        position: { lat: 0, lng: 0 },
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Validate before saving
      const validation = validateCharacter(character);
      if (!validation.valid) {
        throw new Error(validation.errors[0]);
      }

      await db.saveCharacter(character);
      setNewCharName('');
      setMessage(`Character "${character.name}" created!`);
      await refetchCharacters();
    } catch (err) {
      console.error('Error creating character:', err);
      setError(`Failed to create character: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const initGameState = async () => {
    setLoading(true);
    setError('');
    
    try {
      const newGameState: GameState = {
        id: 'main-game',
        activeQuests: [],
        completedQuests: [],
        achievements: [],
        statistics: {
          totalPlayTime: 0,
          distanceTraveled: 0,
          encountersCompleted: 0,
          questsCompleted: 0,
          achievementsUnlocked: 0,
          lastUpdated: Date.now()
        },
        lastPlayed: Date.now(),
        settings: {
          soundEnabled: true,
          vibrationEnabled: true,
          difficulty: 'normal',
          mapStyle: 'street',
          language: 'en'
        }
      };

      await saveGameState(newGameState);
      setMessage('Game state initialized!');
    } catch (err) {
      console.error('Error initializing game state:', err);
      setError(`Failed to initialize game state: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setError('');
    try {
      await exportData();
      setMessage('Data exported! Check your downloads.');
    } catch (err) {
      console.error('Error exporting data:', err);
      setError(`Failed to export data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError('');
    try {
      await importData(file);
      setMessage('Data imported successfully!');
      await refetchCharacters();
    } catch (err) {
      console.error('Error importing data:', err);
      setError(`Failed to import data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-8">Database Demo</h1>
      
      {message && (
        <div className="bg-green-600 text-white p-4 rounded mb-6">
          {message}
        </div>
      )}
      
      {error && (
        <div className="bg-red-600 text-white p-4 rounded mb-6">
          {error}
        </div>
      )}

      {/* Storage Info */}
      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-2xl font-semibold mb-4">Storage Information</h2>
        <div className="text-sm text-gray-400 mb-4 space-y-1">
          <p>ℹ️ <strong>About Persistent Storage:</strong></p>
          <p>• Modern browsers decide automatically (no user prompt anymore)</p>
          <p>• Your data is saved either way - persistence just adds extra protection</p>
        </div>
        
        {storageInfo && !storageInfo.isPersistent && (
          <div className="bg-blue-900/50 border border-blue-700 p-4 rounded mb-4">
            <p className="font-semibold mb-2">💡 Want Persistent Storage?</p>
            <p className="text-sm mb-3">Increase your chances by:</p>
            <ul className="text-sm space-y-1 mb-3">
              <li>• <strong>Bookmark this page</strong> (Ctrl/Cmd + D)</li>
              <li>• Visit regularly for a few days</li>
              <li>• Install as PWA when available</li>
              <li>• Interact with the site frequently</li>
            </ul>
            <button
              onClick={() => {
                alert('Press Ctrl+D (Windows/Linux) or Cmd+D (Mac) to bookmark this page!\n\nBookmarking increases the chance of getting persistent storage.');
              }}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            >
              📚 How to Bookmark
            </button>
          </div>
        )}
        
        {storageInfo && storageInfo.isPersistent && (
          <div className="bg-green-900/50 border border-green-700 p-4 rounded mb-4">
            <p className="font-semibold">✅ Persistent Storage Active!</p>
            <p className="text-sm mt-1">Your data is protected and won't be automatically cleared.</p>
          </div>
        )}
        {storageInfo && (
          <div className="space-y-2">
            <p>Usage: {storageInfo.formattedUsage} / {storageInfo.formattedQuota}</p>
            <p>Percent Used: {(storageInfo.percentUsed * 100).toFixed(2)}%</p>
            <p>Map Tiles: {storageInfo.mapTilesCount}</p>
            <p>Characters: {storageInfo.charactersCount}</p>
            <p>Encounters: {storageInfo.encountersCount}</p>
            <p>Persistent Storage: {storageInfo.isPersistent ? 'Yes' : 'No'}</p>
            
            <div className="flex gap-4 mt-4">
              <button
                onClick={async () => {
                  setError('');
                  setMessage('');
                  try {
                    // Check if already persistent
                    const alreadyPersistent = await storageManager.checkPersistentStorage();
                    if (alreadyPersistent) {
                      setMessage('Storage is already persistent!');
                      return;
                    }
                    
                    // Request persistent storage
                    // Note: Modern browsers don't show a prompt - they decide automatically based on:
                    // - Site engagement (how often user visits)
                    // - If the site is installed as PWA
                    // - If the site is bookmarked
                    const granted = await requestPersistentStorage();
                    if (granted) {
                      setMessage('✅ Persistent storage granted! Your data will be preserved even if storage runs low.');
                    } else {
                      setMessage('ℹ️ Persistent storage not granted. The browser decides this automatically based on site usage. Your data is still saved in IndexedDB and will persist normally - it just might be cleared if device storage becomes critically low (rare).');
                    }
                  } catch (err) {
                    console.error('Error requesting persistent storage:', err);
                    setError(`Failed to request persistent storage: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
                disabled={loading}
              >
                Request Persistent Storage
              </button>
              <button
                onClick={async () => {
                  setError('');
                  try {
                    await performCleanup();
                    setMessage('Cleanup completed!');
                  } catch (err) {
                    console.error('Error performing cleanup:', err);
                    setError(`Failed to perform cleanup: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded disabled:opacity-50"
                disabled={loading}
              >
                Perform Cleanup
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Characters */}
      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-2xl font-semibold mb-4">Characters</h2>
        
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={newCharName}
            onChange={(e) => setNewCharName(e.target.value)}
            placeholder="Character name"
            className="px-4 py-2 bg-gray-700 rounded flex-1"
          />
          <button
            onClick={createCharacter}
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded disabled:opacity-50"
            disabled={loading || charsLoading}
          >
            {loading ? 'Creating...' : 'Create Character'}
          </button>
        </div>

        {charsLoading ? (
          <p>Loading characters...</p>
        ) : characters.length === 0 ? (
          <p className="text-gray-400">No characters yet</p>
        ) : (
          <div className="space-y-2">
            {characters.map((char) => (
              <div key={char.id} className="bg-gray-700 p-3 rounded">
                <p className="font-semibold">{sanitizeDisplayName(char.name)}</p>
                <p className="text-sm text-gray-300">
                  Level {char.level} | Created: {new Date(char.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Game State */}
      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-2xl font-semibold mb-4">Game State</h2>
        
        {gameLoading ? (
          <p>Loading game state...</p>
        ) : !gameState ? (
          <div>
            <p className="text-gray-400 mb-4">No game state initialized</p>
            <button
              onClick={initGameState}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded disabled:opacity-50"
              disabled={loading || gameLoading}
            >
              {loading ? 'Initializing...' : 'Initialize Game State'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p>Last Played: {new Date(gameState.lastPlayed).toLocaleString()}</p>
            <p>Active Quests: {gameState.activeQuests.length}</p>
            <p>Completed Quests: {gameState.completedQuests.length}</p>
            <p>Achievements: {gameState.achievements.length}</p>
            <p>Difficulty: {gameState.settings.difficulty}</p>
            <p>Map Style: {gameState.settings.mapStyle}</p>
          </div>
        )}
      </div>

      {/* Import/Export */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Data Management</h2>
        
        <div className="flex gap-4">
          <button
            onClick={handleExport}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded"
          >
            Export Data
          </button>
          
          <label className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded cursor-pointer">
            Import Data
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}