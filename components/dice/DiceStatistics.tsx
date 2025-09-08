'use client';

import React from 'react';
import { DiceStatistics } from '@/lib/dice/types';

interface DiceStatisticsProps {
  statistics: DiceStatistics;
  onExport?: () => void;
  onReset?: () => void;
}

export function DiceStatisticsDisplay({
  statistics,
  onExport,
  onReset
}: DiceStatisticsProps) {
  // Calculate percentage for each face
  const totalDiceRolled = Object.values(statistics.distribution)
    .reduce((sum, count) => sum + count, 0);
  
  const getPercentage = (count: number) => {
    if (totalDiceRolled === 0) return 0;
    return Math.round((count / totalDiceRolled) * 1000) / 10;
  };

  const expectedPercentage = 14.29; // 1/7 = 14.29%

  // Calculate critical rates
  const criticalSuccessRate = statistics.totalRolls > 0
    ? Math.round((statistics.criticalSuccesses / statistics.totalRolls) * 1000) / 10
    : 0;
  
  const criticalFailureRate = statistics.totalRolls > 0
    ? Math.round((statistics.criticalFailures / statistics.totalRolls) * 1000) / 10
    : 0;

  // Calculate check success rate
  const totalChecks = statistics.successfulChecks + statistics.failedChecks;
  const checkSuccessRate = totalChecks > 0
    ? Math.round((statistics.successfulChecks / totalChecks) * 1000) / 10
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">D7 Statistics</h2>
        <div className="flex gap-2">
          {onExport && (
            <button
              onClick={onExport}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
            >
              Export
            </button>
          )}
          {onReset && (
            <button
              onClick={onReset}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-gray-400 text-sm">Total Rolls</p>
          <p className="text-2xl font-bold text-white">{statistics.totalRolls}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Average Roll</p>
          <p className="text-2xl font-bold text-white">
            {statistics.averageRoll.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">Expected: 4.00</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Lucky 7s</p>
          <p className="text-2xl font-bold text-yellow-400">
            {statistics.criticalSuccesses}
          </p>
          <p className="text-xs text-gray-500">{criticalSuccessRate}%</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Unlucky 1s</p>
          <p className="text-2xl font-bold text-red-400">
            {statistics.criticalFailures}
          </p>
          <p className="text-xs text-gray-500">{criticalFailureRate}%</p>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Face Distribution</h3>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map(face => {
            const count = statistics.distribution[face] || 0;
            const percentage = getPercentage(count);
            const deviation = Math.abs(percentage - expectedPercentage);
            const isClose = deviation < 3; // Within 3% of expected
            
            return (
              <div key={face} className="flex items-center gap-3">
                <div className="w-8 text-center">
                  <span className={`font-bold ${
                    face === 7 ? 'text-yellow-400' : 
                    face === 1 ? 'text-red-400' : 
                    'text-white'
                  }`}>
                    {face === 7 ? '★7' : face}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="bg-gray-700 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        face === 7 ? 'bg-yellow-500' :
                        face === 1 ? 'bg-red-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                    <div 
                      className="absolute top-0 h-full border-r-2 border-gray-400 opacity-50"
                      style={{ left: `${expectedPercentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <span className={`text-sm ${isClose ? 'text-gray-400' : 'text-orange-400'}`}>
                    {percentage}%
                  </span>
                  <span className="text-xs text-gray-500 ml-1">
                    ({count})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Expected: {expectedPercentage}% each (shown as vertical line)
        </p>
      </div>

      {/* Roll Types */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 rounded p-3">
          <p className="text-gray-400 text-sm">Normal Rolls</p>
          <p className="text-xl font-bold text-white">
            {statistics.totalRolls - statistics.advantageRolls - statistics.disadvantageRolls}
          </p>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <p className="text-gray-400 text-sm">Advantage</p>
          <p className="text-xl font-bold text-green-400">
            {statistics.advantageRolls}
          </p>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <p className="text-gray-400 text-sm">Disadvantage</p>
          <p className="text-xl font-bold text-orange-400">
            {statistics.disadvantageRolls}
          </p>
        </div>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-700 rounded p-3">
          <p className="text-gray-400 text-sm mb-2">Lucky Streaks (6-7)</p>
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-gray-500">Current</p>
              <p className="text-lg font-bold text-yellow-400">
                {statistics.streaks.currentLucky}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Best</p>
              <p className="text-lg font-bold text-yellow-400">
                {statistics.streaks.bestLucky}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <p className="text-gray-400 text-sm mb-2">Unlucky Streaks (1-2)</p>
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-gray-500">Current</p>
              <p className="text-lg font-bold text-red-400">
                {statistics.streaks.currentUnlucky}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Worst</p>
              <p className="text-lg font-bold text-red-400">
                {statistics.streaks.worstUnlucky}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DC Checks */}
      {totalChecks > 0 && (
        <div className="bg-gray-700 rounded p-4">
          <h3 className="text-lg font-semibold text-white mb-2">DC Check Performance</h3>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm">Success Rate</p>
              <p className="text-2xl font-bold text-green-400">
                {checkSuccessRate}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">
                {statistics.successfulChecks} / {totalChecks}
              </p>
              <p className="text-xs text-gray-500">
                Passed / Total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 text-xs text-gray-500">
        <p>D7 System: Each face has a 14.29% chance (1/7)</p>
        <p>Average expected value: 4.0</p>
        <p>Statistics update after each roll</p>
      </div>
    </div>
  );
}