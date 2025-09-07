'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { D7Roller } from '@/lib/dice/d7-roller';
import { RollResult, DiceConfig, DEFAULT_CONFIG } from '@/lib/dice/types';

interface UseDiceOptions extends Partial<DiceConfig> {
  onRoll?: (result: RollResult) => void;
  onError?: (error: Error) => void;
}

interface UseDiceReturn {
  // State
  currentRoll: RollResult | null;
  history: RollResult[];
  isRolling: boolean;
  error: Error | null;
  config: DiceConfig;
  statistics: {
    average: number;
    highest: number;
    lowest: number;
    criticals: number;
    fumbles: number;
  };
  
  // Actions
  roll: (formula: string) => Promise<void>;
  rollPool: (count: number, modifier?: number) => Promise<void>;
  quickRoll: (type: '1d7' | '2d7' | '3d7') => Promise<void>;
  clearHistory: () => void;
  updateConfig: (updates: Partial<DiceConfig>) => void;
}

export function useDice(options: UseDiceOptions = {}): UseDiceReturn {
  // Merge config with defaults
  const [config, setConfig] = useState<DiceConfig>({
    ...DEFAULT_CONFIG,
    ...options
  });

  // State
  const [currentRoll, setCurrentRoll] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [statistics, setStatistics] = useState({
    average: 0,
    highest: 0,
    lowest: 0,
    criticals: 0,
    fumbles: 0
  });

  // Refs
  const rollerRef = useRef<D7Roller | null>(null);

  // Initialize roller
  useEffect(() => {
    rollerRef.current = new D7Roller(config.maxHistory);
    
    // Load initial history
    const initialHistory = rollerRef.current.getHistory();
    setHistory(initialHistory);
    
    // Subscribe to roll events
    const unsubscribe = rollerRef.current.subscribe((result) => {
      setCurrentRoll(result);
      setHistory(rollerRef.current!.getHistory());
      updateStatistics();
      
      // Play sound if enabled
      if (config.enableSound) {
        playRollSound();
      }
      
      // Call external handler
      if (options.onRoll) {
        options.onRoll(result);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Update statistics when history changes
  const updateStatistics = useCallback(() => {
    if (rollerRef.current) {
      const stats = rollerRef.current.getStatistics();
      setStatistics(stats);
    }
  }, []);

  // Roll dice with formula
  const roll = useCallback(async (formula: string) => {
    if (!rollerRef.current || isRolling) return;
    
    try {
      setIsRolling(true);
      setError(null);
      
      const result = await rollerRef.current.roll(formula);
      
      // Brief delay to show rolling animation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsRolling(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Roll failed');
      setError(error);
      setIsRolling(false);
      
      if (options.onError) {
        options.onError(error);
      }
    }
  }, [isRolling, options]);

  // Roll dice pool
  const rollPool = useCallback(async (count: number, modifier: number = 0) => {
    if (!rollerRef.current || isRolling) return;
    
    try {
      setIsRolling(true);
      setError(null);
      
      const result = await rollerRef.current.rollPool(count, modifier);
      
      // Brief delay to show rolling animation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsRolling(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Roll failed');
      setError(error);
      setIsRolling(false);
      
      if (options.onError) {
        options.onError(error);
      }
    }
  }, [isRolling, options]);

  // Quick roll shortcuts
  const quickRoll = useCallback(async (type: '1d7' | '2d7' | '3d7') => {
    await roll(type);
  }, [roll]);

  // Clear history
  const clearHistory = useCallback(() => {
    if (rollerRef.current) {
      rollerRef.current.clearHistory();
      setHistory([]);
      setCurrentRoll(null);
      updateStatistics();
    }
  }, [updateStatistics]);

  // Update config
  const updateConfig = useCallback((updates: Partial<DiceConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Play roll sound (simplified)
  const playRollSound = useCallback(() => {
    if (typeof window === 'undefined' || !config.enableSound) return;
    
    try {
      // Create a simple click sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create oscillator for dice sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Quick chirp sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(config.soundVolume * 0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('[Dice] Failed to play sound:', error);
    }
  }, [config.soundVolume, config.enableSound]);

  return {
    // State
    currentRoll,
    history,
    isRolling,
    error,
    config,
    statistics,
    
    // Actions
    roll,
    rollPool,
    quickRoll,
    clearHistory,
    updateConfig
  };
}