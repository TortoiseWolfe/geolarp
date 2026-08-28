'use client';

import React, { useMemo, useState } from 'react';
import {
  ATTRIBUTES,
  AttributeName,
  Character,
  SKILLS,
  SkillName,
} from '@/lib/geolarp/character';
import { formatCode } from '@/lib/geolarp/dice';
import CharacterSigil from '@/components/game/CharacterSigil';

export interface CharacterSheetProps {
  character: Character;
  /** Roll a skill. Omit to render a sheet that is read-only. */
  onRoll?: (skill: SkillName) => void;
  /**
   * The skill whose row is open. One at a time.
   *
   * THE ROLL BELONGS IN THE ROW YOU TOUCHED. It used to live in a separate
   * control mounted above the sheet, so tapping "Search" at the bottom of three
   * phone screens changed something off-screen with no focus move — the player
   * had to scroll back up to find what their own tap did.
   */
  expandedSkill?: SkillName | null;
  /**
   * What to render inside the open row. A slot rather than a built-in roller,
   * so this component stays presentational and the read-only mode below stays
   * free.
   */
  renderExpanded?: (skill: SkillName) => React.ReactNode;
  /** Download the character as a file. */
  onExport?: () => void;
  /** Discard and roll a new character. */
  onRegenerate?: () => void;
  className?: string;
}

/**
 * The DOM id of a skill's row button.
 *
 * Exported because the encounter card's "Go to {skill}" button moves focus
 * here, and a jump target two files spell independently is a jump that breaks
 * silently the first time either side is renamed.
 */
export function skillRowId(skill: SkillName): string {
  return `skill-${skill.toLowerCase()}`;
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
  expandedSkill = null,
  renderExpanded,
  onExport,
  onRegenerate,
  className = '',
}: CharacterSheetProps) {
  const [confirmingNew, setConfirmingNew] = useState(false);

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
          <div className="flex items-center gap-3">
            {/*
              DECORATIVE, because the name it is drawn from is right beside it.
              Naming it too would make a screen reader say "Ada Wren" twice.
            */}
            <CharacterSigil character={character} size={48} decorative />
            <h2
              id="character-sheet-name"
              className="text-base-content text-2xl font-bold"
            >
              {character.name}
            </h2>
          </div>
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

              {/*
                TWO COLUMNS, BECAUSE THE ROWS WERE 82% EMPTY (#59).

                Measured on production at 390px: each skill row was a 298px
                `justify-between` flex holding about 55px of text, so 73-88% of
                every row was nothing — and twenty of them stacked one-per-row
                made the sheet 2116px of a 3318px page.

                THE ROW HEIGHT IS NOT THE THING TO CUT. 44px is a mandated
                touch target, and `mobile-touch-targets.spec.ts` carries a
                coverage floor precisely so nobody shrinks one to make a layout
                fit (#396). So this halves the row COUNT instead: four skills
                per attribute become two rows of two, at the same height.
              */}
              <ul className="mt-2 grid grid-cols-2 gap-1">
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
                  // Gated on `onRoll` as well as the selection: a sheet
                  // with no roll handler is the read-only embed, and a roll
                  // panel inside it would be a control that cannot act.
                  const open = Boolean(onRoll) && expandedSkill === skill;
                  const panelId = `roll-${skill.toLowerCase()}`;
                  return (
                    <li
                      key={skill}
                      /*
                        THE OPEN ROW TAKES THE FULL WIDTH.

                        `renderExpanded` mounts the roller inside this `li` on
                        purpose — "the roller lives in the row, not above the
                        sheet", so the row you touch opens under your thumb. In
                        a two-column grid that would trap a dice tray, a spend
                        control and a Roll button in a ~145px column. Spanning
                        the open row restores the full width exactly where it
                        is needed, and only while it is needed.

                        `min-w-0` because a grid item defaults to `min-width:
                        auto`, which lets a long name push the cell wider than
                        its track instead of fitting inside it — the overflow
                        this change is most likely to cause.
                      */
                      /*
                        TWO WHOLE CLASS STRINGS, NOT AN INTERPOLATION.

                        This was `` `min-w-0${open ? ' col-span-2' : ''}` `` and
                        the Tailwind Prettier plugin ate the leading space on
                        format, fusing them into the single garbage class
                        `min-w-0col-span-2`. The E2E layout check had already
                        passed — it ran BEFORE the formatter — so the only thing
                        that caught it was the unit test asserting `li.col-span-2`
                        exists. Keep both branches as complete literals.
                      */
                      className={open ? 'col-span-2 min-w-0' : 'min-w-0'}
                    >
                      {onRoll ? (
                        <button
                          type="button"
                          id={skillRowId(skill)}
                          onClick={() => onRoll(skill)}
                          aria-expanded={open}
                          aria-controls={open ? panelId : undefined}
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

                      {open && renderExpanded && (
                        <div id={panelId} className="mt-1 mb-2">
                          {renderExpanded(skill)}
                        </div>
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
            somewhere else (`the-world-is-the-board.md:101-103`).

            Naming the last export is what turns a notice into a warning:
            "you have never exported this character" is a different sentence
            from "export a copy to keep it", and only one of them is about the
            character in front of you. */}
        <p className="text-base-content text-sm">
          This character lives in this browser only. Clearing your browser data
          deletes it.{' '}
          {character.exportedAt
            ? `Last exported ${new Date(character.exportedAt).toLocaleDateString()}.`
            : 'You have never exported it.'}
        </p>

        {/*
          One sentence, because a playtester asked for a "profile picture" and
          will otherwise think the mark beside their name is broken or missing.
          It says what the sigil is made of, and it says the two things that
          make it better than an upload rather than a substitute for one.
        */}
        <p className="text-base-content text-sm">
          Your sigil is drawn from your character&rsquo;s name and the moment it
          was rolled. It needs no account and no upload, and it will look the
          same on any device you import this character into.
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
                onClick={() => setConfirmingNew(true)}
              >
                New character
              </button>
            )}
          </div>
        )}

        {/* THE LAST SILENT-LOSS PATH.
            `/privacy-controls` was fixed to confirm before wiping the character
            (#37); this button still generated over the old one with no warning
            and no offer to keep it — the sheet fixing someone else's delete and
            keeping its own. `:103` promises the game warns rather than quietly
            losing, so the export is offered INSIDE the dialog, before the
            destructive control. */}
        {confirmingNew && onRegenerate && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            aria-describedby="discard-body"
            className="bg-base-200 border-base-300 mt-2 rounded border p-4"
          >
            <h3
              id="discard-title"
              className="text-base-content mb-2 text-lg font-bold"
            >
              Replace {character.name}?
            </h3>
            <p id="discard-body" className="text-base-content mb-3 text-sm">
              This cannot be undone.{' '}
              {character.exportedAt
                ? `You last exported this character on ${new Date(character.exportedAt).toLocaleDateString()}.`
                : 'You have never exported this character, so no copy of it exists.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {onExport && (
                <button
                  type="button"
                  className="btn btn-primary min-h-11 flex-1"
                  onClick={onExport}
                >
                  Export first
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline min-h-11 flex-1"
                onClick={() => setConfirmingNew(false)}
              >
                Keep {character.name}
              </button>
              <button
                type="button"
                className="btn btn-error min-h-11 flex-1"
                onClick={() => {
                  setConfirmingNew(false);
                  onRegenerate();
                }}
              >
                Discard and roll a new one
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
