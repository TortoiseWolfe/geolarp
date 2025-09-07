'use client';

import { useState } from 'react';
import { useDice } from '@/hooks/useDice';
import { DiceRoller } from '@/components/dice/DiceRoller';
import { RollHistory } from '@/components/dice/RollHistory';

export default function DiceDemo() {
  const [theme, setTheme] = useState<'classic' | 'fantasy' | 'neon'>('classic');
  
  const {
    currentRoll,
    history,
    isRolling,
    error,
    config,
    statistics,
    roll,
    quickRoll,
    clearHistory,
    updateConfig
  } = useDice({
    onRoll: (result) => {
      console.log('[Dice Demo] Roll result:', result);
    },
    onError: (error) => {
      console.error('[Dice Demo] Roll error:', error);
    }
  });

  const handleSoundToggle = () => {
    updateConfig({ enableSound: !config.enableSound });
  };

  const handleThemeChange = (newTheme: 'classic' | 'fantasy' | 'neon') => {
    setTheme(newTheme);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">D7 Dice System</h1>
          <p className="text-gray-400">
            Simple, functional dice rolling - Boggle style!
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-300">Error: {error.message}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Dice Roller */}
          <div className="space-y-6">
            <DiceRoller
              result={currentRoll}
              isRolling={isRolling}
              onRoll={roll}
              onQuickRoll={quickRoll}
              theme={theme}
              enableSound={config.enableSound}
              onSoundToggle={handleSoundToggle}
            />

            {/* Settings */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Settings</h3>
              
              {/* Theme Selection */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 block mb-2">Dice Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['classic', 'fantasy', 'neon'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      className={`py-2 px-3 rounded capitalize transition-colors ${
                        theme === t
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Toggle */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableSound}
                    onChange={handleSoundToggle}
                    className="w-4 h-4"
                  />
                  <span>Enable Sound Effects</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column - History */}
          <div>
            <RollHistory
              history={history}
              statistics={statistics}
              onClearHistory={clearHistory}
            />
          </div>
        </div>

        {/* Game Rules */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">How It Works</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">D7 Dice System</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• Each die shows 1-7</li>
                <li>• Rolling a 7 (★) is a critical success</li>
                <li>• All 1s is a fumble (critical failure)</li>
                <li>• Support for modifiers: 2d7+3, 3d7-1, etc.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Controls</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• Click &quot;Shake Box&quot; to roll 3d7</li>
                <li>• Use quick buttons for 1d7, 2d7, 3d7</li>
                <li>• Enter custom formulas like &quot;4d7+2&quot;</li>
                <li>• View history and statistics on the right</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}