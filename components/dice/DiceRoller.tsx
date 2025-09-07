'use client';

import React, { useState } from 'react';
import { DiceFace } from './DiceFace';
import { RollResult } from '@/lib/dice/types';

interface DiceRollerProps {
  result: RollResult | null;
  isRolling: boolean;
  onRoll: (formula: string) => Promise<void>;
  onQuickRoll: (type: '1d7' | '2d7' | '3d7') => Promise<void>;
  theme?: 'classic' | 'fantasy' | 'neon';
  enableSound?: boolean;
  onSoundToggle?: () => void;
}

export function DiceRoller({
  result,
  isRolling,
  onRoll,
  onQuickRoll,
  theme = 'classic',
  enableSound = true,
  onSoundToggle
}: DiceRollerProps) {
  const [customFormula, setCustomFormula] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleCustomRoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customFormula && !isRolling) {
      await onRoll(customFormula);
      setCustomFormula('');
    }
  };

  const handleShake = () => {
    if (!isRolling) {
      onQuickRoll('3d7');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">D7 Dice Roller</h2>
        <div className="flex gap-2">
          {onSoundToggle && (
            <button
              onClick={onSoundToggle}
              className="p-2 rounded hover:bg-gray-700 transition-colors"
              aria-label={enableSound ? 'Mute' : 'Unmute'}
            >
              {enableSound ? '🔊' : '🔇'}
            </button>
          )}
        </div>
      </div>

      {/* Dice Display Area - Boggle Style Box */}
      <div className="bg-gray-900 rounded-lg p-6 mb-4 border-2 border-gray-600">
        <div className="flex flex-wrap gap-3 justify-center min-h-[120px] items-center">
          {result && result.dice.length > 0 ? (
            result.dice.map((die, index) => (
              <DiceFace
                key={`${result.id}-${index}`}
                value={die}
                isRolling={isRolling}
                size="lg"
                theme={theme}
              />
            ))
          ) : (
            <div className="text-gray-500 text-center">
              <p className="text-lg mb-2">No dice rolled yet</p>
              <p className="text-sm">Click &quot;Shake Box&quot; or use buttons below</p>
            </div>
          )}
        </div>

        {/* Result Summary */}
        {result && !isRolling && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-gray-400 text-sm">Formula:</span>
                <span className="text-white font-mono ml-2">{result.formula}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 text-sm">Total:</span>
                <span className={`text-3xl font-bold ml-2 ${
                  result.critical ? 'text-yellow-400' : 
                  result.fumble ? 'text-red-400' : 
                  'text-white'
                }`}>
                  {result.total}
                </span>
              </div>
            </div>
            
            {(result.critical || result.fumble) && (
              <div className="mt-2 text-center">
                {result.critical && (
                  <span className="text-yellow-400 font-bold">⭐ Critical! ⭐</span>
                )}
                {result.fumble && (
                  <span className="text-red-400 font-bold">💀 Fumble! 💀</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shake Box Button - Primary Action */}
      <button
        onClick={handleShake}
        disabled={isRolling}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-4 rounded-lg text-xl mb-4 transition-colors"
      >
        {isRolling ? '🎲 Rolling...' : '🎲 Shake Box (3d7)'}
      </button>

      {/* Quick Roll Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => onQuickRoll('1d7')}
          disabled={isRolling}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 rounded transition-colors"
        >
          1d7
        </button>
        <button
          onClick={() => onQuickRoll('2d7')}
          disabled={isRolling}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 rounded transition-colors"
        >
          2d7
        </button>
        <button
          onClick={() => onQuickRoll('3d7')}
          disabled={isRolling}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 rounded transition-colors"
        >
          3d7
        </button>
      </div>

      {/* Custom Formula */}
      <div>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-blue-400 hover:text-blue-300 text-sm mb-2"
        >
          {showCustom ? 'Hide' : 'Show'} Custom Formula
        </button>
        
        {showCustom && (
          <form onSubmit={handleCustomRoll} className="flex gap-2">
            <input
              type="text"
              value={customFormula}
              onChange={(e) => setCustomFormula(e.target.value)}
              placeholder="e.g., 2d7+3"
              disabled={isRolling}
              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isRolling || !customFormula}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold px-6 py-2 rounded transition-colors"
            >
              Roll
            </button>
          </form>
        )}
      </div>
    </div>
  );
}