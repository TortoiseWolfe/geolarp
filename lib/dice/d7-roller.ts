import { RollResult, DiceRoller, RollCallback, CheckResult, DiceStatistics } from './types';

export class D7Roller implements DiceRoller {
  private history: RollResult[] = [];
  private callbacks: Set<RollCallback> = new Set();
  private maxHistory: number;
  private statistics: DiceStatistics;
  private checkHistory: CheckResult[] = [];

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
    this.statistics = this.initializeStatistics();
    this.loadHistory();
    this.loadStatistics();
  }

  /**
   * Parse dice formula and roll
   * Supports: 1d7, 2d7+3, 3d7-1, d7, etc.
   */
  async roll(formula: string): Promise<RollResult> {
    const parsed = this.parseFormula(formula);
    const dice: number[] = [];
    
    // Roll each die
    for (let i = 0; i < parsed.count; i++) {
      dice.push(this.rollD7());
    }

    const diceTotal = dice.reduce((sum, die) => sum + die, 0);
    const total = diceTotal + parsed.modifier;

    const hasSeven = dice.includes(7);
    const allOnes = dice.length > 0 && dice.every(die => die === 1);

    const result: RollResult = {
      id: this.generateId(),
      formula: formula,
      dice: dice,
      modifier: parsed.modifier,
      total: total,
      timestamp: Date.now(),
      critical: hasSeven ? 'success' : (allOnes ? 'failure' : null),
      fumble: allOnes,
      rollType: 'normal'
    };

    this.updateStatistics(result);

    this.addToHistory(result);
    this.notifyCallbacks(result);

    return result;
  }

  /**
   * Roll a pool of dice with optional modifier
   */
  async rollPool(count: number, modifier: number = 0): Promise<RollResult> {
    const formula = modifier !== 0 
      ? `${count}d7${modifier > 0 ? '+' : ''}${modifier}`
      : `${count}d7`;
    
    return this.roll(formula);
  }

  /**
   * Roll with advantage (roll 2d7, keep highest)
   */
  async rollAdvantage(modifier: number = 0): Promise<RollResult> {
    const die1 = this.rollD7();
    const die2 = this.rollD7();
    const kept = Math.max(die1, die2);
    const dropped = Math.min(die1, die2);
    
    const total = kept + modifier;
    const formula = modifier !== 0 
      ? `1d7adv${modifier > 0 ? '+' : ''}${modifier}`
      : `1d7adv`;

    const result: RollResult = {
      id: this.generateId(),
      formula: formula,
      dice: [die1, die2],
      keptDice: [kept],
      droppedDice: [dropped],
      modifier: modifier,
      total: total,
      timestamp: Date.now(),
      critical: kept === 7 ? 'success' : (kept === 1 ? 'failure' : null),
      rollType: 'advantage'
    };

    this.updateStatistics(result);
    this.addToHistory(result);
    this.notifyCallbacks(result);

    return result;
  }

  /**
   * Roll with disadvantage (roll 2d7, keep lowest)
   */
  async rollDisadvantage(modifier: number = 0): Promise<RollResult> {
    const die1 = this.rollD7();
    const die2 = this.rollD7();
    const kept = Math.min(die1, die2);
    const dropped = Math.max(die1, die2);
    
    const total = kept + modifier;
    const formula = modifier !== 0 
      ? `1d7dis${modifier > 0 ? '+' : ''}${modifier}`
      : `1d7dis`;

    const result: RollResult = {
      id: this.generateId(),
      formula: formula,
      dice: [die1, die2],
      keptDice: [kept],
      droppedDice: [dropped],
      modifier: modifier,
      total: total,
      timestamp: Date.now(),
      critical: kept === 7 ? 'success' : (kept === 1 ? 'failure' : null),
      rollType: 'disadvantage'
    };

    this.updateStatistics(result);
    this.addToHistory(result);
    this.notifyCallbacks(result);

    return result;
  }

  /**
   * Roll a skill check against a DC
   */
  async rollCheck(dc: number, modifier: number = 0): Promise<CheckResult> {
    const die = this.rollD7();
    const roll = die + modifier;
    const success = roll >= dc;
    const margin = roll - dc;

    const result: CheckResult = {
      success: success,
      roll: roll,
      modifier: modifier,
      dc: dc,
      critical: die === 7 ? 'success' : (die === 1 ? 'failure' : null),
      margin: margin,
      dice: [die]
    };

    // Update check statistics
    if (success) {
      this.statistics.successfulChecks++;
    } else {
      this.statistics.failedChecks++;
    }

    this.checkHistory.unshift(result);
    if (this.checkHistory.length > this.maxHistory) {
      this.checkHistory = this.checkHistory.slice(0, this.maxHistory);
    }

    this.saveStatistics();
    return result;
  }

  /**
   * Placeholder for animation (handled by renderer components)
   */
  async animateRoll(): Promise<void> {
    // Animation is handled by the renderer components
    return Promise.resolve();
  }

  /**
   * Get roll history
   */
  getHistory(): RollResult[] {
    return [...this.history];
  }

  /**
   * Clear roll history
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  /**
   * Subscribe to roll events
   */
  subscribe(callback: RollCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Roll a single D7 with cryptographically secure RNG
   */
  private rollD7(): number {
    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return (array[0] % 7) + 1;
    }
    // Fallback for non-browser environments
    return Math.floor(Math.random() * 7) + 1;
  }

  /**
   * Parse dice formula
   */
  private parseFormula(formula: string): { count: number; modifier: number } {
    const cleaned = formula.toLowerCase().replace(/\s/g, '');
    
    // Match patterns like: 2d7+3, d7-1, 3d7, d7, 7
    const match = cleaned.match(/^(\d*)d?(\d+)([+-]\d+)?$/);
    
    if (!match) {
      throw new Error(`Invalid dice formula: ${formula}`);
    }

    const [, countStr, sidesStr, modifierStr] = match;
    
    // Check if it's a dice roll (has 'd') or just a number
    const isDiceRoll = cleaned.includes('d');
    
    if (!isDiceRoll) {
      // Just a number, treat as modifier
      return { count: 0, modifier: parseInt(sidesStr) };
    }

    // Verify it's a d7
    if (sidesStr !== '7') {
      throw new Error(`Only D7 dice are supported. Got: d${sidesStr}`);
    }

    const count = countStr ? parseInt(countStr) : 1;
    const modifier = modifierStr ? parseInt(modifierStr) : 0;

    if (count < 1 || count > 100) {
      throw new Error(`Invalid dice count: ${count}. Must be between 1 and 100.`);
    }

    return { count, modifier };
  }

  /**
   * Add result to history
   */
  private addToHistory(result: RollResult): void {
    this.history.unshift(result);
    
    // Trim history if too long
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }
    
    this.saveHistory();
  }

  /**
   * Save history to localStorage
   */
  private saveHistory(): void {
    try {
      localStorage.setItem('dice_history', JSON.stringify(this.history));
    } catch (error) {
      console.warn('[Dice] Failed to save history:', error);
    }
  }

  /**
   * Load history from localStorage
   */
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem('dice_history');
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[Dice] Failed to load history:', error);
      this.history = [];
    }
  }

  /**
   * Notify subscribers of new roll
   */
  private notifyCallbacks(result: RollResult): void {
    this.callbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error('[Dice] Callback error:', error);
      }
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `roll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get comprehensive D7 statistics
   */
  getStatistics(): DiceStatistics {
    return { ...this.statistics };
  }

  /**
   * Initialize statistics object
   */
  private initializeStatistics(): DiceStatistics {
    return {
      totalRolls: 0,
      averageRoll: 0,
      criticalSuccesses: 0,
      criticalFailures: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      successfulChecks: 0,
      failedChecks: 0,
      advantageRolls: 0,
      disadvantageRolls: 0,
      streaks: {
        currentLucky: 0,
        currentUnlucky: 0,
        bestLucky: 0,
        worstUnlucky: 0
      }
    };
  }

  /**
   * Update statistics with new roll
   */
  private updateStatistics(result: RollResult): void {
    // Update roll counts
    this.statistics.totalRolls++;
    
    if (result.rollType === 'advantage') {
      this.statistics.advantageRolls++;
    } else if (result.rollType === 'disadvantage') {
      this.statistics.disadvantageRolls++;
    }

    // Update distribution for each die rolled
    result.dice.forEach(die => {
      if (die >= 1 && die <= 7) {
        this.statistics.distribution[die]++;
      }
    });

    // Update criticals
    if (result.critical === 'success') {
      this.statistics.criticalSuccesses++;
    } else if (result.critical === 'failure') {
      this.statistics.criticalFailures++;
    }

    // Update streaks
    const mainDie = result.keptDice ? result.keptDice[0] : result.dice[0];
    if (mainDie >= 6) {
      this.statistics.streaks.currentLucky++;
      this.statistics.streaks.currentUnlucky = 0;
      if (this.statistics.streaks.currentLucky > this.statistics.streaks.bestLucky) {
        this.statistics.streaks.bestLucky = this.statistics.streaks.currentLucky;
      }
    } else if (mainDie <= 2) {
      this.statistics.streaks.currentUnlucky++;
      this.statistics.streaks.currentLucky = 0;
      if (this.statistics.streaks.currentUnlucky > this.statistics.streaks.worstUnlucky) {
        this.statistics.streaks.worstUnlucky = this.statistics.streaks.currentUnlucky;
      }
    } else {
      this.statistics.streaks.currentLucky = 0;
      this.statistics.streaks.currentUnlucky = 0;
    }

    // Calculate average roll
    const totalDiceValues = Object.entries(this.statistics.distribution)
      .reduce((sum, [face, count]) => sum + (parseInt(face) * count), 0);
    const totalDiceRolled = Object.values(this.statistics.distribution)
      .reduce((sum, count) => sum + count, 0);
    
    if (totalDiceRolled > 0) {
      this.statistics.averageRoll = Math.round((totalDiceValues / totalDiceRolled) * 100) / 100;
    }

    this.saveStatistics();
  }

  /**
   * Save statistics to localStorage
   */
  private saveStatistics(): void {
    try {
      localStorage.setItem('dice_statistics', JSON.stringify(this.statistics));
    } catch (error) {
      console.warn('[Dice] Failed to save statistics:', error);
    }
  }

  /**
   * Load statistics from localStorage
   */
  private loadStatistics(): void {
    try {
      const stored = localStorage.getItem('dice_statistics');
      if (stored) {
        const loaded = JSON.parse(stored);
        // Merge loaded statistics with initialized structure to handle missing fields
        this.statistics = { ...this.initializeStatistics(), ...loaded };
      }
    } catch (error) {
      console.warn('[Dice] Failed to load statistics:', error);
      this.statistics = this.initializeStatistics();
    }
  }

  /**
   * Calculate chi-square test for distribution uniformity
   */
  getDistributionTest(): { chiSquare: number; pValue: string } {
    const totalRolls = Object.values(this.statistics.distribution)
      .reduce((sum, count) => sum + count, 0);
    
    if (totalRolls < 30) {
      return { chiSquare: 0, pValue: 'Insufficient data (need 30+ rolls)' };
    }

    const expected = totalRolls / 7;
    let chiSquare = 0;

    Object.values(this.statistics.distribution).forEach(observed => {
      chiSquare += Math.pow(observed - expected, 2) / expected;
    });

    // Degrees of freedom = 6 (7 categories - 1)
    // Critical value at 0.05 significance = 12.592
    const isUniform = chiSquare < 12.592;
    
    return {
      chiSquare: Math.round(chiSquare * 100) / 100,
      pValue: isUniform ? 'Distribution appears uniform' : 'Distribution may be non-uniform'
    };
  }
}