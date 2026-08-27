'use client';

import React from 'react';
import { Cell, cellKey, grid3x3, seedOf } from '@/lib/geolarp/cell';
import { encounterFor } from '@/lib/geolarp/encounter';
import { LADDER } from '@/lib/geolarp/ladder';
import { placeName } from '@/lib/geolarp/place';

export interface CellGridProps {
  /** The cell at the middle of the nine. */
  centre: Cell;
  /** Fixes the day, so a story or a test is not at the mercy of the clock. */
  today?: Date;
  /**
   * Move one cell. ABSENT MEANS READ-ONLY, the same contract `CharacterSheet`
   * uses for `onRoll`: without a handler the tiles render as text rather than
   * as buttons, because a control that cannot act is worse than no control.
   */
  onStep?: (dx: number, dy: number) => void;
  /**
   * Where the device is pointing, if it is ever asked. Unused today and
   * deliberately present: the compass was deferred, not rejected, and this is
   * the seam it drops into.
   */
  headingDeg?: number;
  className?: string;
}

const KIND_LABEL: Record<string, string> = {
  monster: 'Monster',
  trader: 'Trader',
  cache: 'Cache',
  shrine: 'Shrine',
  trap: 'Trap',
};

/** Row-major offsets matching `grid3x3`: north-west first, south-east last. */
const STEPS: ReadonlyArray<[number, number]> = [
  [-1, 1],
  [0, 1],
  [1, 1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

const DIRECTION = [
  'north-west',
  'north',
  'north-east',
  'west',
  'here',
  'east',
  'south-west',
  'south',
  'south-east',
];

/**
 * The nine cells around you, and the way to walk between them.
 *
 * WHY A GRID AND NOT A MAP. A real map was rejected on privacy, not on cost:
 * every tile fetch sends position-derived z/x/y to a third-party CDN on every
 * pan, which would make the privacy page's central claim false. And this app
 * *cannot* draw a position dot even if it wanted to — the raw fix dies inside
 * `setCellFromFix` and never enters React state.
 *
 * So it draws a highlighted 100-metre square WITH NO DOT IN IT. Every mapping
 * UI in the world puts a dot on you; the absence here is the privacy promise
 * made visible, rather than asked for on faith.
 *
 * DIFFICULTY IS PIPS, NOT A WORD AND NOT A COLOUR. The measured budget is 82px
 * per tile at 320px (320 − px-4 32 − p-4 32 − gaps 8): "Monster" fits at
 * `text-xs`, "Very Difficult" does not at any weight. And pips are COUNTED
 * rather than hued, so the colourblind sweep passes by construction instead of
 * by a palette someone has to keep re-checking.
 *
 * @category game
 */
export default function CellGrid({
  centre,
  today,
  onStep,
  className = '',
}: CellGridProps) {
  const cells = grid3x3(centre);

  const tiles = cells.map((cell, i) => {
    const enc = encounterFor(seedOf(cell, today));
    const rank = LADDER.findIndex((b) => b.id === enc.difficulty) + 1;
    return {
      cell,
      i,
      step: STEPS[i],
      direction: DIRECTION[i],
      kind: KIND_LABEL[enc.kind] ?? enc.kind,
      rank,
      name: placeName(cell),
      here: STEPS[i][0] === 0 && STEPS[i][1] === 0,
    };
  });

  return (
    <div
      className={`flex flex-col gap-2${className ? ` ${className}` : ''}`}
      role="group"
      /*
        The name states the CAPABILITY, not the shape. Read-only the grid shows
        the nine cells and moves nothing, and calling that "Move one cell"
        would be a control name for something that is not a control.
        `character-played.spec.ts` locates the walkable case by the exact
        string below — accessible names are an API in this repo.
      */
      aria-label={onStep ? 'Move one cell' : 'The nine cells around you'}
    >
      <p className="text-base-content text-xs">North is up.</p>

      <div className="grid w-full max-w-xs grid-cols-3 gap-1">
        {tiles.map((t) => {
          const body = (
            <>
              <span className="font-semibold">{t.kind}</span>
              <span
                aria-hidden="true"
                className="font-mono text-[0.65rem] tracking-tight"
              >
                {'•'.repeat(t.rank)}
                {'·'.repeat(LADDER.length - t.rank)}
              </span>
            </>
          );

          // The accessible name carries what the pips encode, spelled out.
          // Counting dots is a sighted affordance; "difficulty 4 of 6" is the
          // same fact in a form a screen reader can say.
          const label = t.here
            ? `${t.name}, where you are. ${t.kind}, difficulty ${t.rank} of ${LADDER.length}`
            : `Move ${t.direction} to ${t.name}. ${t.kind}, difficulty ${t.rank} of ${LADDER.length}`;

          const shell = `flex min-h-11 flex-col items-center justify-center gap-0.5 rounded border p-1 text-center text-xs ${
            t.here
              ? 'border-primary bg-primary text-primary-content'
              : 'border-base-300 bg-base-100 text-base-content'
          }`;

          if (!onStep || t.here) {
            return (
              <div key={cellKey(t.cell)} className={shell} aria-label={label}>
                {body}
              </div>
            );
          }
          return (
            <button
              key={cellKey(t.cell)}
              type="button"
              className={`${shell} hover:border-primary`}
              aria-label={label}
              onClick={() => onStep(t.step[0], t.step[1])}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
