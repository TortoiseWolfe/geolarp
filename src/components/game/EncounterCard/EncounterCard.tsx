'use client';

import React from 'react';
import { Encounter } from '@/lib/geolarp/encounter';
import { Cell, cellCentre, cellKey } from '@/lib/geolarp/cell';
import { bandOf } from '@/lib/geolarp/ladder';

export interface EncounterCardProps {
  encounter: Encounter;
  /** The cell it belongs to, shown so a player can see the grid is real. */
  cell?: Cell;
  /** Slot for the roller. */
  children?: React.ReactNode;
  className?: string;
}

const KIND_LABEL: Record<Encounter['kind'], string> = {
  monster: 'Monster',
  trader: 'Trader',
  cache: 'Cache',
  shrine: 'Shrine',
  trap: 'Trap',
};

/**
 * What is in this cell.
 *
 * The card shows the SEED it came from. That is not debug output left in by
 * accident: the design's claim is that an encounter "is derived from the
 * place, not handed out" (`the-world-is-the-board.md:74-77`), and showing the
 * seed is what lets two players standing together check that they are looking
 * at the same thing.
 *
 * @category game
 */
export default function EncounterCard({
  encounter,
  cell,
  children,
  className = '',
}: EncounterCardProps) {
  const centre = cell ? cellCentre(cell) : null;

  return (
    <article
      className={`card bg-base-100 border-base-300 border${className ? ` ${className}` : ''}`}
      aria-labelledby="encounter-title"
    >
      <div className="card-body gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-primary">
            {KIND_LABEL[encounter.kind]}
          </span>
          {/* The band NAMES the cell — that is a rating and it is honest.
              What it must not do is print its range where a player reads it as
              the number to beat; see formatTarget. */}
          <span className="badge badge-outline">
            {bandOf(encounter.difficulty).label}
          </span>
        </div>

        <h2
          id="encounter-title"
          className="text-base-content text-xl font-bold"
        >
          {encounter.title}
        </h2>

        <p className="text-base-content">{encounter.description}</p>

        {children}

        {/*
          THE OUTCOME IS NARRATED ONCE, IN THE ROW YOU TOUCHED.

          This card used to render its own `role="status" aria-live="polite"`
          region for the same roll the roller already announced — so a screen
          reader heard the result twice, and the two sentences did not even
          agree: this one labelled the outcome with `encounter.skill`, the
          SUGGESTED skill, so rolling anything else reported the wrong name.

          `D7Roller` keeps the surviving region. It is more informative, it
          labels the roll with the skill that actually produced it, and it sits
          under the thumb that pressed Roll.
        */}
        {/*
          THE AUDIT TRAIL IS ONE TAP AWAY, NOT GONE.

          The seed is what lets two players standing together check they are
          looking at the same thing, so it cannot be deleted — but it is also
          the least-read text on the card, and it was costing a third of the
          card's height on a phone. Collapsed, with the cell key promoted into
          the summary so the check is still possible without opening anything.
        */}
        <footer className="text-base-content mt-1 text-xs">
          <details className="border-base-300 bg-base-200 [&[open]>summary]:border-base-300 rounded-lg border [&[open]>summary]:border-b">
            <summary className="text-base-content flex min-h-11 cursor-pointer items-center p-4 font-semibold">
              {cell ? (
                <>
                  Cell&nbsp;
                  <span className="font-mono break-all">{cellKey(cell)}</span>
                </>
              ) : (
                'Where this came from'
              )}
            </summary>
            <div className="p-4 pt-3">
              <p>
                {centre && (
                  <>
                    Centred near{' '}
                    <span className="font-mono">
                      {centre.lat.toFixed(4)}, {centre.lon.toFixed(4)}
                    </span>
                    .{' '}
                  </>
                )}
                Seeded from{' '}
                <span className="font-mono break-all">{encounter.seed}</span> —
                everyone in this cell today meets the same thing. It resets at
                midnight UTC.
              </p>
            </div>
          </details>
        </footer>
      </div>
    </article>
  );
}
