'use client';

import React from 'react';
import { Character } from '@/lib/geolarp/character';
import { Rng } from '@/lib/geolarp/rng';

export type CharacterSigilProps = {
  character: Character;
  /** Rendered size in pixels. */
  size?: number;
  className?: string;
} & (
  | {
      /** Accessible name. Use when the sigil is the only thing identifying the character. */
      label: string;
      decorative?: never;
    }
  | {
      /** The sigil sits beside the character's visible name and repeats it. */
      decorative: true;
      label?: never;
    }
);

/** 5x5, of which only the left three columns are drawn; the rest is a mirror. */
const SIZE = 5;
const SEEDED_COLS = 3;

/** A sigil must not be blank or solid. Both look like a rendering failure. */
const MIN_FILLED = 4;
const MAX_FILLED = 11;

/**
 * A colour role, never a raw value.
 *
 * Every one of these is a theme token with a matching `-content` foreground
 * that the theme guarantees. Picking an arbitrary hue from the seed is how a
 * generated avatar ends up failing contrast for one character in forty and
 * nobody finds out — this cannot, because no random character can produce a
 * colour the theme has not already been checked against.
 */
const INKS = ['fill-primary', 'fill-secondary', 'fill-accent'] as const;

/**
 * The seed for a character's sigil.
 *
 * `name` and `created` and NOTHING ELSE, and each exclusion is deliberate:
 *
 * - `characterPoints` mutates, so the face would change mid-roll.
 * - `attributes` and `skills` would drift the moment `advance()` is wired up,
 *   so a player's sigil would change as they improve.
 * - `exportedAt` is stripped by `toExportJSON`, so it would differ on the
 *   importing device — and looking the same everywhere is the point.
 *
 * `created` IS carried in the export, so an imported character keeps its face.
 */
export function sigilSeed(character: Character): string {
  return `sigil:${character.name}#${character.created}`;
}

/** The 5x5 grid, row-major, as booleans. */
export function sigilCells(character: Character): boolean[] {
  const rng = new Rng(sigilSeed(character));
  let left: boolean[] = [];
  let filled = 0;

  // Bounded reroll: a blank or solid sigil reads as a bug, not as a crest.
  // Bounded rather than while(true) because a seeded RNG that somehow could
  // not satisfy the range would otherwise hang the render.
  for (let attempt = 0; attempt < 24; attempt += 1) {
    left = Array.from(
      { length: SIZE * SEEDED_COLS },
      () => rng.int(0, 1) === 1
    );
    filled = 0;
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SEEDED_COLS; col += 1) {
        // Columns 0 and 1 are mirrored, so they count twice; the centre once.
        if (left[row * SEEDED_COLS + col]) filled += col === 2 ? 1 : 2;
      }
    }
    if (filled >= MIN_FILLED && filled <= MAX_FILLED) break;
  }

  const cells: boolean[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      // BILATERAL SYMMETRY is what makes seeded noise read as a crest rather
      // than as static. Column 3 mirrors 1, column 4 mirrors 0.
      const source = col < SEEDED_COLS ? col : SIZE - 1 - col;
      cells.push(left[row * SEEDED_COLS + source]);
    }
  }
  return cells;
}

/**
 * A character's mark, drawn from its name and the moment it was rolled.
 *
 * NOT A FIELD ON THE CHARACTER — a pure function of one. That is what keeps it
 * free: zero bytes in storage and in the export, `version` stays 1,
 * `toExportJSON` output is byte-identical, and it looks the same on any device
 * you import into.
 *
 * WHY NOT A PHOTO. The arithmetic loses twice. QR v40/L holds 2,953 bytes and
 * the current export is ~819; even a tiny avatar adds ~800-2,000 base64,
 * landing near 2,800 — a 177x177-module code phones struggle to read off a
 * screen, which would make the QR half of the published export promise
 * permanently unscannable. And the `avatars` bucket is PUBLIC READ, while a
 * character file is designed to be handed to other people: exporting the
 * fiction would export a working public URL to a photograph of a real person.
 *
 * The `/profile` avatar must never appear on `/character` for the same reason
 * — it needs a session, on a route whose whole point is that it does not.
 *
 * @category game
 */
export default function CharacterSigil({
  character,
  size = 48,
  className = '',
  ...rest
}: CharacterSigilProps) {
  const cells = sigilCells(character);
  const ink = new Rng(`${sigilSeed(character)}|ink`).pick(INKS);

  const a11y =
    'decorative' in rest && rest.decorative
      ? ({ 'aria-hidden': true, focusable: false } as const)
      : ({ role: 'img', 'aria-label': rest.label } as const);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`bg-base-200 border-base-300 rounded border ${ink}${className ? ` ${className}` : ''}`}
      {...a11y}
    >
      {cells.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={i % SIZE}
            y={Math.floor(i / SIZE)}
            width={1}
            height={1}
          />
        ) : null
      )}
    </svg>
  );
}
