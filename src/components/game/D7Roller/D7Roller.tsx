'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DiceCode,
  formatCode,
  RollResult,
  roll as rollDice,
} from '@/lib/geolarp/dice';
import { Difficulty, bandOf, formatTarget } from '@/lib/geolarp/ladder';
import { successChance, describeChance } from '@/lib/geolarp/odds';
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
  /**
   * An outcome already rolled for this cell and skill, restored on mount.
   *
   * THIS COMPONENT IS KEYED BY ENCOUNTER AND SKILL, so stepping to another cell
   * and back remounts it and its own state is gone by design. The memory that
   * survives lives in the hook. Without this prop the surviving live region
   * would show nothing after a round trip, and "a cell remembers what happened
   * there" would be true of the model and invisible in the product.
   */
  restoredResult?: RollResult | null;
  /** Inject a seeded RNG to make a roll reproducible (tests, shared seeds). */
  rng?: Rng;
  /**
   * Seeds the dice, so this cell's roll is fixed until the world reseeds.
   *
   * RE-ROLLING IS NOT BLOCKED; IT IS POINTLESS. The Roll button had no
   * once-per-encounter guard, so a player could sit in one cell and press it
   * until the dice came up — free, unbounded, and the obvious thing to do.
   * A disabled button would have said "you may not"; identical faces say
   * "there is nothing here for you", which needs no enforcement and no stored
   * record of what you have already tried.
   *
   * The caller composes the cell, the character and the skill into this. The
   * STAKE is added here, deliberately: without it a free failure would tell
   * you your exact deficit, so you would buy precisely the dice needed and
   * never waste a point — the sink would be a vending machine. With it, each
   * stake is an independent roll and raising one is a bet.
   */
  seed?: string;
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
  restoredResult = null,
  rng,
  seed,
  className = '',
}: D7RollerProps) {
  const [result, setResult] = useState<RollResult | null>(restoredResult);
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

  /**
   * Adopt a restored outcome when it arrives, not only at mount.
   *
   * Initial state is not enough: stepping to another cell and back remounts
   * this component, and on the render where the key returns, the hook's effect
   * has not run yet — so the restored value is still the away-cell's null. It
   * lands one render later, and a `useState` initialiser never sees it.
   *
   * Safe against clobbering a fresh roll: after rolling, the hook stores that
   * same result and hands it straight back, so this sets what is already set.
   */
  useEffect(() => {
    if (restoredResult) setResult(restoredResult);
  }, [restoredResult]);

  const target = difficulty ? bandOf(difficulty).floor : undefined;

  /**
   * THE STAKE CAN NEVER EXCEED THE BALANCE, not even for one render.
   *
   * `spend` is component state and `availablePoints` is a prop, and nothing
   * reconciled them. A roll that emptied the purse left a stale stake behind:
   * the fieldset below unmounts at zero, the Roll button stays enabled, and the
   * next press asked the model to spend points that were already gone —
   * `spendCharacterPoints` throws, from inside a setState updater, which is a
   * white screen on the route that holds the player's character.
   *
   * Derived on read rather than corrected in an effect: an effect would have an
   * ordering hazard against the prop change, and this has none.
   */
  const staked = Math.min(spend, availablePoints);

  const handleRoll = useCallback(() => {
    const stake = staked;
    // The injected rng keeps precedence so tests stay deterministic; then the
    // cell seed; then chance, for a roller with no cell behind it.
    const source =
      rng ?? (seed ? new Rng(`${seed}|${stake}`) : new Rng(makeSeed()));
    const outcome = rollDice(rating, source, target, stake);

    /**
     * A STAKE IS PER ROLL, AND COMMITTING IT IS ONE ACT.
     *
     * Nothing reset `spend` after a roll, so pressing Roll a second time
     * charged again for the same encounter — one roll, two payments. Both the
     * reduced-motion path and the animated path commit through this single
     * closure so they cannot drift apart.
     */
    const commit = () => {
      setResult(outcome);
      setSpend(0);
      onResult?.(outcome, stake);
    };

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      commit();
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
        commit();
      }, ROLL_MS)
    );
  }, [rating, rng, seed, target, staked, onResult]);

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
            {staked > 0 ? ` + ${staked}d7` : ''}
          </p>
        </div>

        {/*
          WHAT THE STAKE BUYS, WHILE THERE IS STILL TIME TO CHANGE IT.

          A playtester spent all five Character Points on a Heroic cell and
          lost. The premise everyone worked from — including the ticket — was
          that a starting sheet simply cannot beat Heroic. It can: 0.1% at zero
          stake, 43% at five. They were not hitting a wall, they were taking a
          coin-flip nobody had shown them.

          So the economy was never the defect; the silence was. This line moves
          with the ± buttons, so a player watching 0.1% become 43% is making a
          decision instead of a wish — and one watching 16.7% become 47.9%
          against a Difficult cell can see what a point is actually worth.
        */}
        {difficulty && target !== undefined && (
          <p className="text-base-content text-sm">
            Chance at this stake:{' '}
            <strong>
              {describeChance(successChance(rating, target, staked))}
            </strong>
          </p>
        )}

        {difficulty && (
          <p className="text-base-content text-sm">
            {/* A FLOOR, not a range. `roll()` succeeds on `total >= floor`, so
                "Moderate (13-17)" stated a window the rules do not have and
                implied 18 overshoots. The band still NAMES the cell below. */}
            Needs {formatTarget(difficulty)} · {bandOf(difficulty).label}
          </p>
        )}

        {/*
          RENDERED AT ZERO, DISABLED, WITH A REASON.

          This whole fieldset used to unmount when the balance hit zero, which
          is precisely what a playtester hit: they spent five points against a
          Heroic cell, lost, and the control simply vanished. Nothing said the
          points were gone, nothing said they could come back, and the obvious
          reading — "the game is broken" — was the reasonable one.

          A missing control cannot answer a question. A disabled one can.
        */}
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="text-base-content mb-1 text-sm">
            {availablePoints > 0
              ? 'Spend Character Points — each buys one die'
              : 'No Character Points. Beat a Moderate cell or harder to earn one.'}
          </legend>
          <button
            type="button"
            className="btn btn-sm min-h-11 min-w-11"
            onClick={() => setSpend((n) => Math.max(0, n - 1))}
            disabled={staked === 0 || rolling}
            aria-label="Spend one fewer Character Point"
          >
            −
          </button>
          <output
            className="text-base-content min-w-11 text-center font-mono"
            aria-label={`${staked} of ${availablePoints} Character Points`}
          >
            {staked} / {availablePoints}
          </output>
          <button
            type="button"
            className="btn btn-sm min-h-11 min-w-11"
            onClick={() => setSpend((n) => Math.min(availablePoints, n + 1))}
            disabled={staked >= availablePoints || rolling}
            aria-label="Spend one more Character Point"
          >
            +
          </button>
        </fieldset>

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

        {/*
          "HOW LONG DOES A TURN LAST?" — asked in a playtest, and the honest
          answer is that there is no turn. The unit of play is the cell, and it
          holds until the date rolls over.

          Gated on `seed`, not on `result` alone: without a cell behind it the
          roller seeds from chance and a re-roll gives different dice, so the
          sentence would be false in exactly the case it is easiest to leave
          unchecked.
        */}
        {seed && result && !rolling && (
          <p className="text-base-content text-xs">
            This cell&rsquo;s roll is fixed until midnight UTC. Spending
            Character Points changes the pool, and so changes the roll.
          </p>
        )}
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
