'use client';

import { useState } from 'react';
import { useDice } from '@/hooks/useDice';
import { DiceRoller } from '@/components/dice/DiceRoller';
import { RollHistory } from '@/components/dice/RollHistory';
import { DiceStatisticsDisplay } from '@/components/dice/DiceStatistics';

export default function DiceDemo() {
  const [theme, setTheme] = useState<'classic' | 'fantasy' | 'neon'>('classic');
  const [showStatistics, setShowStatistics] = useState(false);
  
  const {
    currentRoll,
    history,
    isRolling,
    error,
    config,
    statistics,
    roll,
    rollAdvantage,
    rollDisadvantage,
    rollCheck,
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
              onRollAdvantage={rollAdvantage}
              onRollDisadvantage={rollDisadvantage}
              onRollCheck={rollCheck}
              theme={theme}
              enableSound={config.enableSound}
              enableHaptics={config.enableHaptics}
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

          {/* Right Column - History & Statistics */}
          <div className="space-y-6">
            {/* Toggle Statistics/History */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowStatistics(false)}
                className={`flex-1 py-2 px-4 rounded transition-colors ${
                  !showStatistics
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Roll History
              </button>
              <button
                onClick={() => setShowStatistics(true)}
                className={`flex-1 py-2 px-4 rounded transition-colors ${
                  showStatistics
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Statistics
              </button>
            </div>
            
            {/* Display History or Statistics */}
            {showStatistics ? (
              <DiceStatisticsDisplay
                statistics={statistics}
                onExport={() => {
                  const data = JSON.stringify(statistics, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dice-statistics-${Date.now()}.json`;
                  a.click();
                }}
                onReset={() => {
                  clearHistory();
                  window.location.reload();
                }}
              />
            ) : (
              <RollHistory
                history={history}
                statistics={statistics}
                onClearHistory={clearHistory}
              />
            )}
          </div>
        </div>

        {/* Game Rules */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">How It Works</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">D7 Dice System</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• Each die: 1-7 (14.29% per face)</li>
                <li>• Average roll: 4.0 (vs D6&apos;s 3.5)</li>
                <li>• Lucky 7: Critical success (★)</li>
                <li>• Unlucky 1: Critical failure</li>
                <li>• Advantage: Roll 2d7, keep highest</li>
                <li>• Disadvantage: Roll 2d7, keep lowest</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">Controls & Shortcuts</h4>
              <ul className="space-y-1 text-gray-300">
                <li>• Space: Quick roll 1d7</li>
                <li>• Shift+Space: Roll with advantage</li>
                <li>• Ctrl+Space: Roll with disadvantage</li>
                <li>• DC Checks: Test against difficulty</li>
                <li>• Statistics: Track probability distribution</li>
                <li>• Haptic feedback on mobile devices</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}