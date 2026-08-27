'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DiceCode,
  formatCode,
  RollResult,
  roll as rollDice,
} from '@/lib/geolarp/dice';
import { Difficulty, bandOf, formatTarget } from '@/lib/geolarp/ladder';
import { Rng } from '@/lib/geolarp/rng';

export interface D7RollerProps {
  /** What is being rolled, e.g. "Search" or "Brawl". */
  label: string;
  /** The rating, as a dice code with pips. */
  rating: DiceCode;
  /** Optional target. Without one the roller just reports a total. */
  difficulty?: Difficulty;
  /** Character Points the player may spend, one die each. */
  availablePoints?: number;
  /** Called with the result and the points actually spent. */
  onResult?: (result: RollResult, pointsSpent: number) => void;
  /** Inject a seeded RNG to make a roll reproducible (tests, shared seeds). */
  rng?: Rng;
  className?: string;
}

const ROLL_MS = 600;
const TICK_MS = 80;

/**
 * Rolls a d7 pool with the Wild Die.
 *
 * The animation is a courtesy, not the mechanism: the result is computed once,
 * up front, and the tumbling faces are decoration over it. That keeps a roll
 * honest under `prefers-reduced-motion`, where it is skipped entirely, and
 * means a test never has to wait for an animation to read the outcome.
 *
 * @category game
 */
export default function D7Roller({
  label,
  rating,
  difficulty,
  availablePoints = 0,
  onResult,
  rng,
  className = '',
}: D7RollerProps) {
  const [result, setResult] = useState<RollResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [tumble, setTumble] = useState<number[]>([]);
  const [spend, setSpend] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  // A rating change invalidates any result shown against the old one.
  useEffect(() => {
    setResult(null);
  }, [rating.dice, rating.pips, difficulty]);

  const target = difficulty ? bandOf(difficulty).floor : undefined;

  const handleRoll = useCallback(() => {
    const outcome = rollDice(rating, rng ?? new Rng(makeSeed()), target, spend);

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      setResult(outcome);
      onResult?.(outcome, spend);
      return;
    }

    setRolling(true);
    setResult(null);
    const ticks = Math.floor(ROLL_MS / TICK_MS);
    for (let i = 0; i < ticks; i += 1) {
      timers.current.push(
        setTimeout(() => {
          setTumble(outcome.faces.map(() => 1 + Math.floor(Math.random() * 7)));
        }, i * TICK_MS)
      );
    }
    timers.current.push(
      setTimeout(() => {
        setRolling(false);
        setTumble([]);
        setResult(outcome);
        onResult?.(outcome, spend);
      }, ROLL_MS)
    );
  }, [rating, rng, target, spend, onResult]);

  const faces = rolling ? tumble : (result?.faces ?? []);

  return (
    <section
      className={`card bg-base-200 border-base-300 border${className ? ` ${className}` : ''}`}
      aria-labelledby={`d7-${slug(label)}-heading`}
    >
      <div className="card-body gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3
            id={`d7-${slug(label)}-heading`}
            className="card-title text-base-content text-lg"
          >
            {label}
          </h3>
          <p className="text-base-content font-mono text-sm">
            {formatCode(rating)}
            {spend > 0 ? ` + ${spend}d7` : ''}
          </p>
        </div>

        {difficulty && (
          <p className="text-base-content text-sm">
            {/* A FLOOR, not a range. `roll()` succeeds on `total >= floor`, so
                "Moderate (13-17)" stated a window the rules do not have and
                implied 18 overshoots. The band still NAMES the cell below. */}
            Needs {formatTarget(difficulty)} · {bandOf(difficulty).label}
          </p>
        )}

        {availablePoints > 0 && (
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="text-base-content mb-1 text-sm">
              Spend Character Points — each buys one die
            </legend>
            <button
              type="button"
              className="btn btn-sm min-h-11 min-w-11"
              onClick={() => setSpend((n) => Math.max(0, n - 1))}
              disabled={spend === 0 || rolling}
              aria-label="Spend one fewer Character Point"
            >
              −
            </button>
            <output
              className="text-base-content min-w-11 text-center font-mono"
              aria-label={`${spend} of ${availablePoints} Character Points`}
            >
              {spend} / {availablePoints}
            </output>
            <button
              type="button"
              className="btn btn-sm min-h-11 min-w-11"
              onClick={() => setSpend((n) => Math.min(availablePoints, n + 1))}
              disabled={spend >= availablePoints || rolling}
              aria-label="Spend one more Character Point"
            >
              +
            </button>
          </fieldset>
        )}

        <button
          type="button"
          className="btn btn-primary min-h-11 w-full"
          onClick={handleRoll}
          disabled={rolling}
        >
          {rolling ? 'Rolling…' : `Roll ${label}`}
        </button>

        {faces.length > 0 && (
          <ul
            className="flex flex-wrap gap-2"
            aria-label="Dice faces, wild die first"
          >
            {faces.map((face, i) => (
              <li
                key={i}
                className={`flex min-h-11 min-w-11 items-center justify-center rounded border font-mono text-lg ${
                  i === 0
                    ? 'border-primary bg-primary text-primary-content'
                    : 'border-base-300 bg-base-100 text-base-content'
                }`}
              >
                <span className="sr-only">
                  {i === 0 ? 'Wild die: ' : 'Die: '}
                </span>
                {face}
              </li>
            ))}
          </ul>
        )}

        {/* The live region is always present so a result is announced even
            when it replaces a previous one. It is NAMED because <output>
            above carries an implicit role of "status" too — two unnamed live
            regions are indistinguishable to anything navigating by role. */}
        <p
          role="status"
          aria-live="polite"
          aria-label="Roll result"
          className="text-base-content"
        >
          {result && !rolling ? describe(result, label, difficulty) : ''}
        </p>
      </div>
    </section>
  );
}

function describe(
  r: RollResult,
  label: string,
  difficulty?: Difficulty
): string {
  const parts = [`${label}: rolled ${r.total}`];
  if (difficulty) {
    parts.push(
      `against ${bandOf(difficulty).label}, needing ${formatTarget(difficulty)} — ${r.success ? 'success' : 'failure'}`
    );
  }
  if (r.outcome === 'critical') {
    parts.push('The wild die came up seven and exploded.');
  }
  if (r.outcome === 'complication') {
    parts.push('The wild die came up one: something goes wrong regardless.');
  }
  return parts.join(' ');
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function makeSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
