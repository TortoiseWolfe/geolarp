'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DiceFace } from './DiceFace';
import { RollResult, CheckResult } from '@/lib/dice/types';

interface DiceRollerProps {
  result: RollResult | null;
  isRolling: boolean;
  onRoll: (formula: string) => Promise<void>;
  onQuickRoll: (type: '1d7' | '2d7' | '3d7') => Promise<void>;
  onRollAdvantage?: (modifier?: number) => Promise<void>;
  onRollDisadvantage?: (modifier?: number) => Promise<void>;
  onRollCheck?: (dc: number, modifier?: number) => Promise<CheckResult | null>;
  theme?: 'classic' | 'fantasy' | 'neon';
  enableSound?: boolean;
  enableHaptics?: boolean;
  onSoundToggle?: () => void;
}

export function DiceRoller({
  result,
  isRolling,
  onRoll,
  onQuickRoll,
  onRollAdvantage,
  onRollDisadvantage,
  onRollCheck,
  theme = 'classic',
  enableSound = true,
  enableHaptics = true,
  onSoundToggle
}: DiceRollerProps) {
  const [customFormula, setCustomFormula] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [showDCCheck, setShowDCCheck] = useState(false);
  const [selectedDC, setSelectedDC] = useState(4); // Default moderate
  const [dcModifier, setDCModifier] = useState(0);
  const [lastCheckResult, setLastCheckResult] = useState<CheckResult | null>(null);

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
      triggerHaptic('medium');
    }
  };

  const triggerHaptic = useCallback((pattern: 'light' | 'medium' | 'heavy' | 'success' | 'failure') => {
    if (!enableHaptics || typeof navigator === 'undefined' || !navigator.vibrate) return;
    
    const patterns = {
      light: [50],
      medium: [100],
      heavy: [200],
      success: [50, 50, 50], // Double buzz
      failure: [500] // Long buzz
    };
    
    navigator.vibrate(patterns[pattern]);
  }, [enableHaptics]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isRolling) return;
      
      // Space: Standard roll
      if (e.code === 'Space' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        onQuickRoll('1d7');
      }
      // Shift+Space: Advantage
      else if (e.code === 'Space' && e.shiftKey && onRollAdvantage) {
        e.preventDefault();
        onRollAdvantage(0);
      }
      // Ctrl+Space: Disadvantage
      else if (e.code === 'Space' && e.ctrlKey && onRollDisadvantage) {
        e.preventDefault();
        onRollDisadvantage(0);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isRolling, onQuickRoll, onRollAdvantage, onRollDisadvantage]);

  // Trigger haptics for criticals
  useEffect(() => {
    if (result && !isRolling) {
      if (result.critical === 'success') {
        triggerHaptic('success');
      } else if (result.critical === 'failure') {
        triggerHaptic('failure');
      }
    }
  }, [result, isRolling, triggerHaptic]);

  const handleDCCheck = async () => {
    if (onRollCheck && !isRolling) {
      const checkResult = await onRollCheck(selectedDC, dcModifier);
      if (checkResult) {
        setLastCheckResult(checkResult);
        triggerHaptic(checkResult.success ? 'success' : 'failure');
      }
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

      {/* Advantage/Disadvantage Buttons */}
      {(onRollAdvantage || onRollDisadvantage) && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {onRollAdvantage && (
            <button
              onClick={() => onRollAdvantage(0)}
              disabled={isRolling}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
              title="Roll 2d7, keep highest (Shift+Space)"
            >
              <span>↑</span> Advantage
            </button>
          )}
          {onRollDisadvantage && (
            <button
              onClick={() => onRollDisadvantage(0)}
              disabled={isRolling}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-bold py-3 rounded transition-colors flex items-center justify-center gap-2"
              title="Roll 2d7, keep lowest (Ctrl+Space)"
            >
              <span>↓</span> Disadvantage
            </button>
          )}
        </div>
      )}

      {/* DC Check Section */}
      {onRollCheck && (
        <div className="mb-4">
          <button
            onClick={() => setShowDCCheck(!showDCCheck)}
            className="text-blue-400 hover:text-blue-300 text-sm mb-2"
          >
            {showDCCheck ? 'Hide' : 'Show'} DC Check
          </button>
          
          {showDCCheck && (
            <div className="bg-gray-700 rounded p-4">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Difficulty Class</label>
                  <select
                    value={selectedDC}
                    onChange={(e) => setSelectedDC(Number(e.target.value))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded"
                  >
                    <option value={2}>Trivial (DC 2 - 85.7%)</option>
                    <option value={3}>Easy (DC 3 - 71.4%)</option>
                    <option value={4}>Moderate (DC 4 - 57.1%)</option>
                    <option value={5}>Hard (DC 5 - 42.9%)</option>
                    <option value={6}>Very Hard (DC 6 - 28.6%)</option>
                    <option value={7}>Extreme (DC 7 - 14.3%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Modifier</label>
                  <input
                    type="number"
                    value={dcModifier}
                    onChange={(e) => setDCModifier(Number(e.target.value))}
                    min={-5}
                    max={5}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded"
                  />
                </div>
              </div>
              <button
                onClick={handleDCCheck}
                disabled={isRolling}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 rounded transition-colors"
              >
                Roll DC {selectedDC} Check {dcModifier !== 0 && `(${dcModifier > 0 ? '+' : ''}${dcModifier})`}
              </button>
              
              {/* DC Check Result */}
              {lastCheckResult && (
                <div className={`mt-3 p-3 rounded ${
                  lastCheckResult.success ? 'bg-green-900/50' : 'bg-red-900/50'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-bold ${
                      lastCheckResult.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {lastCheckResult.success ? '✓ Success!' : '✗ Failed'}
                    </span>
                    <span className="text-white">
                      {lastCheckResult.dice[0]} + {lastCheckResult.modifier} = {lastCheckResult.roll} vs DC {lastCheckResult.dc}
                    </span>
                  </div>
                  {lastCheckResult.critical && (
                    <p className={`text-sm mt-1 ${
                      lastCheckResult.critical === 'success' ? 'text-yellow-400' : 'text-orange-400'
                    }`}>
                      {lastCheckResult.critical === 'success' ? '⭐ Critical Success!' : '💀 Critical Failure!'}
                    </p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">
                    Margin: {lastCheckResult.margin > 0 ? '+' : ''}{lastCheckResult.margin}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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