'use client';

import React, { useMemo } from 'react';
import {
  ATTRIBUTES,
  AttributeName,
  Character,
  SKILLS,
  SkillName,
} from '@/lib/geolarp/character';
import { formatCode } from '@/lib/geolarp/dice';

export interface CharacterSheetProps {
  character: Character;
  /** Roll a skill. Omit to render a sheet that is read-only. */
  onRoll?: (skill: SkillName) => void;
  /** Download the character as a file. */
  onExport?: () => void;
  /** Discard and roll a new character. */
  onRegenerate?: () => void;
  className?: string;
}

/**
 * A character sheet in D6 units.
 *
 * Every rating reads as a dice code with pips, because that is what it is —
 * `3d7+2`, not a number out of seven. Skills sit under the attribute that
 * governs them, and an untrained skill shows its attribute's rating rather
 * than a blank, since that is what a player actually rolls.
 *
 * @category game
 */
export default function CharacterSheet({
  character,
  onRoll,
  onExport,
  onRegenerate,
  className = '',
}: CharacterSheetProps) {
  const grouped = useMemo(() => {
    const out = {} as Record<AttributeName, SkillName[]>;
    for (const a of ATTRIBUTES) out[a] = [];
    for (const s of Object.keys(SKILLS) as SkillName[]) out[SKILLS[s]].push(s);
    return out;
  }, []);

  return (
    <article
      className={`card bg-base-100 border-base-300 border${className ? ` ${className}` : ''}`}
      aria-labelledby="character-sheet-name"
    >
      <div className="card-body gap-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="character-sheet-name"
            className="text-base-content text-2xl font-bold"
          >
            {character.name}
          </h2>
          <p className="text-base-content text-sm">
            Character Points:{' '}
            <span className="font-mono font-bold">
              {character.characterPoints}
            </span>
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {ATTRIBUTES.map((attr) => (
            <section
              key={attr}
              className="bg-base-200 border-base-300 rounded border p-3"
              aria-labelledby={`attr-${attr.toLowerCase()}`}
            >
              <h3
                id={`attr-${attr.toLowerCase()}`}
                className="text-base-content flex items-baseline justify-between gap-2 text-lg font-semibold"
              >
                <span>{attr}</span>
                <span className="font-mono">
                  {formatCode(character.attributes[attr])}
                </span>
              </h3>

              <ul className="mt-2 flex flex-col gap-1">
                {grouped[attr].map((skill) => {
                  const trained = character.skills[skill];
                  const code = trained ?? character.attributes[attr];
                  // The name and the rating are separate elements in BOTH
                  // branches. Concatenating them read identically on screen
                  // and made the row a single text node, which is a different
                  // thing to anything reading the DOM.
                  const note = trained
                    ? ' (trained)'
                    : ` (untrained, rolls at ${attr})`;
                  return (
                    <li key={skill}>
                      {onRoll ? (
                        <button
                          type="button"
                          onClick={() => onRoll(skill)}
                          className={`btn btn-ghost btn-sm min-h-11 w-full justify-between px-2 font-normal ${
                            trained
                              ? 'text-base-content font-semibold'
                              : 'text-base-content'
                          }`}
                        >
                          <span>{skill}</span>
                          <span className="font-mono">{formatCode(code)}</span>
                          <span className="sr-only">{note}</span>
                        </button>
                      ) : (
                        <p
                          className={`flex min-h-11 items-center justify-between px-2 ${
                            trained
                              ? 'text-base-content font-semibold'
                              : 'text-base-content'
                          }`}
                        >
                          <span>{skill}</span>
                          <span className="font-mono">{formatCode(code)}</span>
                          <span className="sr-only">{note}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* The published promise makes the PLAYER responsible for keeping this
            character, so the warning is part of the sheet, not a footnote
            somewhere else (`the-world-is-the-board.md:101-103`). */}
        <p className="text-base-content text-sm">
          This character lives in this browser only. Clearing your browser data
          deletes it. Export a copy to keep it.
        </p>

        {(onExport || onRegenerate) && (
          <div className="flex flex-wrap gap-2">
            {onExport && (
              <button
                type="button"
                className="btn btn-primary min-h-11 flex-1"
                onClick={onExport}
              >
                Export character
              </button>
            )}
            {onRegenerate && (
              <button
                type="button"
                className="btn btn-outline min-h-11 flex-1"
                onClick={onRegenerate}
              >
                New character
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
