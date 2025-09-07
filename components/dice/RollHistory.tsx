'use client';

import React from 'react';
import { RollResult } from '@/lib/dice/types';

interface RollHistoryProps {
  history: RollResult[];
  statistics: {
    average: number;
    highest: number;
    lowest: number;
    criticals: number;
    fumbles: number;
  };
  onClearHistory: () => void;
  maxDisplay?: number;
}

export function RollHistory({
  history,
  statistics,
  onClearHistory,
  maxDisplay = 10
}: RollHistoryProps) {
  const displayHistory = history.slice(0, maxDisplay);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Roll History</h3>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Statistics */}
      {history.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">
            Statistics (Last {Math.min(10, history.length)} Rolls)
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-400">Average:</span>
              <span className="text-white ml-2 font-mono">{statistics.average}</span>
            </div>
            <div>
              <span className="text-gray-400">Highest:</span>
              <span className="text-green-400 ml-2 font-mono">{statistics.highest}</span>
            </div>
            <div>
              <span className="text-gray-400">Lowest:</span>
              <span className="text-red-400 ml-2 font-mono">{statistics.lowest}</span>
            </div>
            <div>
              <span className="text-gray-400">Criticals:</span>
              <span className="text-yellow-400 ml-2 font-mono">{statistics.criticals}</span>
            </div>
            <div>
              <span className="text-gray-400">Fumbles:</span>
              <span className="text-red-400 ml-2 font-mono">{statistics.fumbles}</span>
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {displayHistory.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No rolls yet</p>
        ) : (
          displayHistory.map((roll) => (
            <div
              key={roll.id}
              className="bg-gray-700 rounded p-3 flex justify-between items-center hover:bg-gray-600 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">
                    {formatTime(roll.timestamp)}
                  </span>
                  <span className="text-white font-mono text-sm">
                    {roll.formula}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {roll.dice.map((die, index) => (
                    <span
                      key={index}
                      className={`inline-block w-6 h-6 text-center rounded text-xs font-bold ${
                        die === 7 ? 'bg-yellow-500 text-black' :
                        die === 1 ? 'bg-red-500 text-white' :
                        'bg-gray-600 text-white'
                      }`}
                    >
                      {die}
                    </span>
                  ))}
                  {roll.modifier !== 0 && (
                    <span className="text-gray-400 text-xs ml-1">
                      {roll.modifier > 0 ? '+' : ''}{roll.modifier}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold ${
                  roll.critical ? 'text-yellow-400' :
                  roll.fumble ? 'text-red-400' :
                  'text-white'
                }`}>
                  {roll.total}
                </div>
                {roll.critical && (
                  <span className="text-yellow-400 text-xs">CRIT</span>
                )}
                {roll.fumble && (
                  <span className="text-red-400 text-xs">FUMBLE</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {history.length > maxDisplay && (
        <div className="mt-2 text-center text-gray-400 text-sm">
          Showing {maxDisplay} of {history.length} rolls
        </div>
      )}
    </div>
  );
}