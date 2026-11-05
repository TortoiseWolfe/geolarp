'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  DiceCode,
  MAX_POINTS_PER_ROLL,
  PURCHASE_COST,
  Purchase,
  RollResult,
  buy,
  formatCode,
  pointsSpent,
  purchaseRefusal,
  purchaseSeed,
  replayPurchases,
  roll as rollDice,
} from '@/lib/geolarp/dice';
import { Difficulty, bandOf, formatTarget } from '@/lib/geolarp/ladder';
import {
  dieRescueChance,
  rerollRescueChance,
  successChance,
  describeChance,
} from '@/lib/geolarp/odds';
import { Rng } from '@/lib/geolarp/rng';

export interface D7RollerProps {
  /** What is being rolled, e.g. "Search" or "Brawl". */
  label: string;
  /** The rating, as a dice code with pips. */
  rating: DiceCode;
  /** Optional target. Without one the roller just reports a total. */
  difficulty?: Difficulty;
  /** Character Points the player holds. Each buys an extra die or a reroll. */
  availablePoints?: number;
  /**
   * Called with the result and the points spent on THIS roll so far (a running
   * total, not the increment), first with 0 for the dice as rolled and again
   * after each purchase. The caller bills the difference, so a replay of the
   * same state costs nothing.
   */
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
   * first roll is the same for everyone who holds that seed, and so are the
   * purchases made after it (`purchaseSeed`). Points never change the first
   * roll: they buy a second chance, at one point each and two at most.
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

  /** The injected rng keeps precedence so tests stay deterministic. */
  const baseRng = () =>
    rng ?? (seed ? new Rng(`${seed}|0`) : new Rng(makeSeed()));

  /**
   * BUYING IS ONE ACT PER POINT, AND IT HAPPENS AFTER THE DICE ARE DOWN.
   *
   * It used to be a stake set before the roll. That made the choice blind, and
   * it let a player who changed the stake roll fresh dice on the same cell,
   * which is why the stake went into the seed at all. Buying after the roll
   * needs neither: the choice is made looking at the dice, and the first roll
   * never changes.
   */
  const handleBuy = (kind: Purchase) => {
    if (!result || purchaseRefusal(result, availablePoints)) return;
    const n = (result.purchases?.length ?? 0) + 1;
    const source =
      rng ?? new Rng(purchaseSeed(seed ?? `${makeSeed()}`, kind, n));
    const outcome = buy(rating, result, kind, source, target);
    setResult(outcome);
    onResult?.(outcome, pointsSpent(outcome));
  };

  const commitWithMotion = (outcome: RollResult) => {
    const commit = () => {
      setResult(outcome);
      onResult?.(outcome, pointsSpent(outcome));
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
  };

  /**
   * Roll the pool. With a cell seed, a second press replays the roll AND what
   * was bought on it, rather than selling it again: the dice are a function of
   * the cell, and so are the purchases.
   *
   * Without a seed (or with an injected rng) a press is a fresh roll, and the
   * purchases belong to the roll they were made on, so they start again.
   */
  const handleRoll = () => {
    const first = rollDice(rating, baseRng(), target, 0);
    const replay = seed && !rng ? (result?.purchases ?? []) : [];
    const outcome = replayPurchases(rating, first, seed ?? '', replay, target);
    commitWithMotion(outcome);
  };

  const refusal = purchaseRefusal(result, availablePoints);
  const spent = result ? pointsSpent(result) : 0;

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
            {result && result.bonusDice > 0 ? ` + ${result.bonusDice}d7` : ''}
          </p>
        </div>

        {/*
          THE ODDS, BEFORE THE DICE ARE DOWN.

          A playtester spent all five Character Points on a Heroic cell and
          lost. The premise everyone worked from — including the ticket — was
          that a starting sheet simply cannot beat Heroic. It can: 0.1% as
          rated, 43% with five dice bought. They were not hitting a wall, they
          were taking a coin-flip nobody had shown them.

          So the economy was never the defect; the silence was. This line is the
          chance on the roll as rated. After a miss, the two buttons below each
          carry their own chance from where the dice lie, so the decision to buy
          is made looking at both numbers.
        */}
        {difficulty && target !== undefined && (
          <p className="text-base-content text-sm">
            Chance on this roll:{' '}
            <strong>{describeChance(successChance(rating, target))}</strong>
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
          BOUGHT AFTER THE ROLL, AND ONLY WHILE THE ROLL IS A MISS.

          Rendered with a reason at every stage rather than unmounted: before
          the roll it says when buying opens, at zero points it says how points
          come back, at the cap it says why nothing more is on offer. This
          control used to vanish when the balance hit zero, which a playtester
          read, reasonably, as the game being broken. A missing control cannot
          answer a question. A disabled one can.

          A WIN HIDES IT. Nothing is left to fix, and a reroll could only lose
          what the player already holds.
        */}
        {!result && !rolling && (
          <p className="text-base-content text-sm">
            {availablePoints > 0
              ? `Roll first. Then you may spend Character Points on an extra die or a reroll: ${PURCHASE_COST} point each, ${MAX_POINTS_PER_ROLL} at most on one roll.`
              : 'No Character Points. Beat a Moderate cell or harder to earn one.'}
          </p>
        )}

        {result && !rolling && refusal !== 'won' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-base-content mb-1 text-sm">
              {refusal === 'broke'
                ? 'No Character Points. Beat a Moderate cell or harder to earn one.'
                : refusal === 'cap'
                  ? `You have spent the ${MAX_POINTS_PER_ROLL} Character Points a roll allows.`
                  : `Not enough? ${PURCHASE_COST} Character Point buys one of these (${spent} of ${MAX_POINTS_PER_ROLL} spent on this roll).`}
            </legend>
            <button
              type="button"
              className="btn btn-sm min-h-11 justify-start"
              onClick={() => handleBuy('die')}
              disabled={refusal !== null}
            >
              Buy an extra die — {PURCHASE_COST} Character Point
              {target !== undefined
                ? ` · ${describeChance(dieRescueChance(result.total, target))} to win from here`
                : ''}
            </button>
            <button
              type="button"
              className="btn btn-sm min-h-11 justify-start"
              onClick={() => handleBuy('reroll')}
              disabled={refusal !== null}
            >
              Buy a reroll — {PURCHASE_COST} Character Point
              {target !== undefined
                ? ` · ${describeChance(rerollRescueChance(rating, target, result.bonusDice))} to win from here`
                : ''}
            </button>
          </fieldset>
        )}

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
            This cell&rsquo;s roll is fixed until midnight UTC. Character Points
            buy a second chance on it, never a different first roll.
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
