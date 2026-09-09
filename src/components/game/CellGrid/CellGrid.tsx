'use client';

import React from 'react';
import {
  Cell,
  cellKey,
  flower,
  seedOf,
  type HexDirection,
} from '@/lib/geolarp/cell';
import { encounterFor } from '@/lib/geolarp/encounter';
import { LADDER } from '@/lib/geolarp/ladder';
import { placeName } from '@/lib/geolarp/place';

export interface CellGridProps {
  /** The cell at the middle of the seven. */
  centre: Cell;
  /** Fixes the day, so a story or a test is not at the mercy of the clock. */
  today?: Date;
  /**
   * Move one cell. ABSENT MEANS READ-ONLY, the same contract `CharacterSheet`
   * uses for `onRoll`: without a handler the tiles render as text rather than
   * as buttons, because a control that cannot act is worse than no control.
   */
  onStep?: (direction: HexDirection) => void;
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

/**
 * The seven positions `flower` returns, north-first, with the centre at index 3.
 *
 * `null` is the centre — the one tile that is not a step. There are SIX steps and
 * no due north (#87): a pointy-top hex has flat sides east and west, so its
 * neighbours are E, NE, NW, W, SW, SE. The square grid offered eight, four of
 * which were 141 m; every one of these is 100 m, which is the whole trade.
 */
const STEPS: ReadonlyArray<HexDirection | null> = [
  'north-west',
  'north-east',
  'west',
  null,
  'east',
  'south-west',
  'south-east',
];

/** How many tiles sit on each screen row: the 2-3-2 of a hex flower. */
const ROWS: ReadonlyArray<number> = [2, 3, 2];

/**
 * The seven cells around you, and the six ways to walk between them.
 *
 * WHY A GRID AND NOT A MAP. A real map was rejected on privacy, not on cost:
 * every tile fetch sends position-derived z/x/y to a third-party CDN on every
 * pan, which would make the privacy page's central claim false. And this app
 * *cannot* draw a position dot even if it wanted to — the raw fix dies inside
 * `setCellFromFix` and never enters React state.
 *
 * So it draws a highlighted 100-metre cell WITH NO DOT IN IT. Every mapping
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
  const cells = flower(centre);

  const tiles = cells.map((cell, i) => {
    const enc = encounterFor(seedOf(cell, today));
    const rank = LADDER.findIndex((b) => b.id === enc.difficulty) + 1;
    const step = STEPS[i];
    return {
      cell,
      i,
      step,
      direction: step ?? 'here',
      kind: KIND_LABEL[enc.kind] ?? enc.kind,
      rank,
      name: placeName(cell),
      here: step === null,
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
      aria-label={onStep ? 'Move one cell' : 'The seven cells around you'}
    >
      {/*
        Still true, and now load-bearing in a different way: rows run north to
        south, but there is no tile due north to step to. A pointy-top hex has
        flat sides east and west, so the northern pair sits either side of
        straight ahead (#87).
      */}
      <p className="text-base-content text-xs">
        North is up. Six ways to step, each 100 metres.
      </p>

      <div className="flex w-full max-w-xs flex-col items-center gap-1">
        {/*
          2-3-2, not a 3x3. Three centred flex rows rather than a CSS grid with
          span tricks: the offset rows ARE the lattice, and a reader should be
          able to see that in the markup.
        */}
        {ROWS.map((count, row) => {
          const from = ROWS.slice(0, row).reduce((a, b) => a + b, 0);
          return (
            <div key={row} className="flex w-full justify-center gap-1">
              {tiles.slice(from, from + count).map((t) => {
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

                if (!onStep || t.here || t.step === null) {
                  return (
                    <div
                      key={cellKey(t.cell)}
                      className={`${shell} flex-1`}
                      aria-label={label}
                      data-testid="cell-tile"
                    >
                      {body}
                    </div>
                  );
                }
                const direction = t.step;
                return (
                  <button
                    key={cellKey(t.cell)}
                    type="button"
                    className={`${shell} hover:border-primary flex-1`}
                    aria-label={label}
                    data-testid="cell-tile"
                    onClick={() => onStep(direction)}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
