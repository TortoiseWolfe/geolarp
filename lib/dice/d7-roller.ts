import { RollResult, DiceRoller, RollCallback } from './types';

export class D7Roller implements DiceRoller {
  private history: RollResult[] = [];
  private callbacks: Set<RollCallback> = new Set();
  private maxHistory: number;

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
    this.loadHistory();
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

    const result: RollResult = {
      id: this.generateId(),
      formula: formula,
      dice: dice,
      modifier: parsed.modifier,
      total: total,
      timestamp: Date.now(),
      critical: dice.includes(7),
      fumble: dice.every(die => die === 1)
    };

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
   * Placeholder for animation (handled by renderer components)
   */
  async animateRoll(_result: RollResult): Promise<void> {
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
   * Roll a single D7
   */
  private rollD7(): number {
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
   * Calculate statistics for recent rolls
   */
  getStatistics(count: number = 10): {
    average: number;
    highest: number;
    lowest: number;
    criticals: number;
    fumbles: number;
  } {
    const recent = this.history.slice(0, count);
    
    if (recent.length === 0) {
      return {
        average: 0,
        highest: 0,
        lowest: 0,
        criticals: 0,
        fumbles: 0
      };
    }

    const totals = recent.map(r => r.total);
    const average = totals.reduce((sum, t) => sum + t, 0) / totals.length;
    const highest = Math.max(...totals);
    const lowest = Math.min(...totals);
    const criticals = recent.filter(r => r.critical).length;
    const fumbles = recent.filter(r => r.fumble).length;

    return {
      average: Math.round(average * 10) / 10,
      highest,
      lowest,
      criticals,
      fumbles
    };
  }
}