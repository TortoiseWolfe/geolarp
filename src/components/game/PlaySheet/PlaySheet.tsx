'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import CharacterSheet from '@/components/game/CharacterSheet';
import CharacterBuilder from '@/components/game/CharacterBuilder';
import D7Roller from '@/components/game/D7Roller';
import { Character, SkillName, ratingFor } from '@/lib/geolarp/character';
import { remainingEarnToday } from '@/lib/geolarp/character';
import { DAILY_EARN_CAP } from '@/lib/geolarp/reward';
import { Difficulty, LADDER, formatTarget } from '@/lib/geolarp/ladder';
import { LIBRARY_LIMIT } from '@/lib/geolarp/library';
import { usePlaySheet } from './usePlaySheet';

export interface PlaySheetProps {
  /** Fixes the day, so a story or a test is not at the mercy of the clock. */
  today?: Date;
  className?: string;
}

const PANEL =
  'border-base-300 bg-base-200 text-base-content rounded-lg border p-4';

/**
 * The MVP character sheet: a local library of characters, the full twenty-skill
 * sheet, the dice roller wired to it, the Character Points wallet and its
 * history, and export and import as a file.
 *
 * LOCAL-ONLY. There is no account, no sign-in, no sync and no location here.
 * Characters are read from and written to this browser's storage, nothing else;
 * `tests/unit/play-local-only.test.ts` fails if a network call or a location
 * request appears in the files that make up this surface.
 *
 * @category game
 */
export default function PlaySheet({
  today = new Date(),
  className = '',
}: PlaySheetProps) {
  const play = usePlaySheet(today);
  const [creating, setCreating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Character | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    replaces: Character;
    char: Character;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!play.ready) {
    return (
      <p className="text-base-content" role="status">
        Loading your characters…
      </p>
    );
  }

  const { character } = play;
  const wrap = `flex flex-col gap-6${className ? ` ${className}` : ''}`;

  const importButton = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a character file"
        data-testid="import-file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          // Read on this device. The file never leaves it.
          const parsed = play.importText(await file.text());
          if (!parsed) return;
          if (parsed.replaces) {
            setPendingImport({ replaces: parsed.replaces, char: parsed.char });
          } else {
            play.commitImport(parsed.char);
            setCreating(false);
          }
        }}
      />
      <button
        type="button"
        className="btn btn-outline min-h-11"
        onClick={() => fileInput.current?.click()}
      >
        Import a character file
      </button>
    </>
  );

  const notice = play.notice && (
    <p
      role="alert"
      className="border-error text-base-content rounded-lg border p-3 text-sm"
    >
      {play.notice}{' '}
      <button type="button" className="link" onClick={play.clearNotice}>
        Dismiss
      </button>
    </p>
  );

  if (!character || creating) {
    return (
      <div className={wrap}>
        {notice}
        <section className="card bg-base-100 border-base-300 mx-auto w-full max-w-xl border">
          <div className="card-body gap-4">
            <CharacterBuilder
              onCreate={(c) => {
                if (play.addNew(c)) setCreating(false);
              }}
              onCancel={character ? () => setCreating(false) : undefined}
            />
            <div className="border-base-300 flex flex-wrap items-center gap-2 border-t pt-4">
              <p className="text-base-content text-sm">
                Already have a character file?
              </p>
              {importButton}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const left = remainingEarnToday(character, play.today);
  const earnedToday = DAILY_EARN_CAP - left;
  const history = [...(character.history ?? [])].reverse();

  return (
    <div className={wrap}>
      {notice}

      <section aria-labelledby="library-heading" className={PANEL}>
        <h2 id="library-heading" className="text-lg font-bold">
          Characters on this device
        </h2>
        <ul className="mt-2 flex flex-col gap-1">
          {play.library.characters.map((c) => (
            <li key={c.created}>
              <button
                type="button"
                className={`btn btn-sm min-h-11 w-full justify-start ${
                  c.created === character.created
                    ? 'btn-primary'
                    : 'btn-outline'
                }`}
                aria-pressed={c.created === character.created}
                onClick={() => play.select(c.created)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline min-h-11"
            disabled={play.library.characters.length >= LIBRARY_LIMIT}
            onClick={() => setCreating(true)}
          >
            New character
          </button>
          {importButton}
        </div>
      </section>

      {pendingImport && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="import-title"
          aria-describedby="import-body"
          className={PANEL}
        >
          <h3 id="import-title" className="text-lg font-bold">
            Replace {pendingImport.replaces.name} on this device?
          </h3>
          <p id="import-body" className="mt-2 text-sm">
            This file is the same character. Importing it overwrites the copy
            here, including any Character Points and history it has gained since
            the file was made. This cannot be undone.{' '}
            {pendingImport.replaces.exportedAt
              ? `You last exported the copy here on ${new Date(pendingImport.replaces.exportedAt).toLocaleDateString()}.`
              : 'You have never exported the copy here, so no other copy of it exists.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingImport.replaces.created === character.created && (
              <button
                type="button"
                className="btn btn-primary min-h-11 flex-1"
                onClick={play.exportActive}
              >
                Export the copy here first
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline min-h-11 flex-1"
              onClick={() => setPendingImport(null)}
            >
              Keep the copy here
            </button>
            <button
              type="button"
              className="btn btn-error min-h-11 flex-1"
              onClick={() => {
                play.commitImport(pendingImport.char);
                setPendingImport(null);
              }}
            >
              Replace it
            </button>
          </div>
        </div>
      )}

      <section aria-labelledby="wallet-heading" className={PANEL}>
        <h2 id="wallet-heading" className="text-lg font-bold">
          Character Points
        </h2>
        <p className="mt-1 text-sm">
          <span className="font-mono text-2xl font-bold">
            {character.characterPoints}
          </span>{' '}
          in your wallet. Earned today:{' '}
          <span
            className="font-mono font-bold whitespace-nowrap"
            data-testid="earned-today"
          >
            {earnedToday} of {DAILY_EARN_CAP}
          </span>
          . After a miss, 1 point buys an extra die or a reroll, 2 at most on
          one roll.
        </p>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">
            Spending and winning history
          </summary>
          {history.length === 0 ? (
            <p className="text-sm">
              Nothing yet. Win or spend a point to start it.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm" aria-label="History">
              {history.map((h, i) => (
                <li key={`${h.day}-${i}`} className="flex gap-2">
                  <span className="font-mono font-bold">
                    {h.change > 0 ? `+${h.change}` : h.change}
                  </span>
                  <span>
                    {h.skill}: {h.note} ({h.day})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>

      <section aria-labelledby="roll-heading" className={PANEL}>
        <h2 id="roll-heading" className="text-lg font-bold">
          Roll against
        </h2>
        <label
          className="mt-1 flex flex-col gap-1 text-sm"
          htmlFor="difficulty"
        >
          Difficulty
          <select
            id="difficulty"
            className="select select-bordered min-h-11 w-full max-w-xs"
            value={play.difficulty}
            onChange={(e) => play.setDifficulty(e.target.value as Difficulty)}
          >
            {LADDER.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} (needs {formatTarget(b.id)})
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-sm">
          Tap a skill below to open its dice. Rolling the same skill at the same
          difficulty gives the same dice until midnight UTC, so rolling again
          gets you nothing.
        </p>
      </section>

      <CharacterSheet
        character={character}
        layout="list"
        onRoll={(s: SkillName) => play.selectSkill(s)}
        expandedSkill={play.selectedSkill}
        renderExpanded={(s) => (
          <D7Roller
            key={`${play.seed}`}
            seed={play.seed ?? undefined}
            restoredResult={play.result}
            label={s}
            rating={ratingFor(character, s)}
            difficulty={play.difficulty}
            availablePoints={character.characterPoints}
            onResult={play.resolve}
          />
        )}
      />

      <section aria-labelledby="keep-heading" className={PANEL}>
        <h2 id="keep-heading" className="text-lg font-bold">
          Keep this character
        </h2>
        <p className="mt-1 text-sm">
          {character.name} lives in this browser only. Clearing your browser
          data deletes it, and nobody else has a copy.{' '}
          {character.exportedAt
            ? `Last exported ${new Date(character.exportedAt).toLocaleDateString()}.`
            : 'You have never exported it.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary min-h-11 flex-1"
            onClick={play.exportActive}
          >
            Export {character.name} as a file
          </button>
          <button
            type="button"
            className="btn btn-outline min-h-11 flex-1"
            onClick={() => setConfirmRemove(character)}
          >
            Remove from this device
          </button>
        </div>
        {confirmRemove && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-title"
            aria-describedby="remove-body"
            className="bg-base-100 border-base-300 mt-3 rounded border p-4"
          >
            <h3 id="remove-title" className="text-lg font-bold">
              Remove {confirmRemove.name}?
            </h3>
            <p id="remove-body" className="mt-2 text-sm">
              This cannot be undone.{' '}
              {confirmRemove.exportedAt
                ? `You last exported this character on ${new Date(confirmRemove.exportedAt).toLocaleDateString()}.`
                : 'You have never exported this character, so no copy of it exists.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary min-h-11 flex-1"
                onClick={play.exportActive}
              >
                Export first
              </button>
              <button
                type="button"
                className="btn btn-outline min-h-11 flex-1"
                onClick={() => setConfirmRemove(null)}
              >
                Keep {confirmRemove.name}
              </button>
              <button
                type="button"
                className="btn btn-error min-h-11 flex-1"
                onClick={() => {
                  play.remove(confirmRemove.created);
                  setConfirmRemove(null);
                }}
              >
                Remove it
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="text-base-content text-sm">
        No account, no location, no sync: this page works with the network off.
        Read the{' '}
        <Link href="/app-privacy" className="link">
          app privacy page
        </Link>{' '}
        for exactly what that means.
      </p>
    </div>
  );
}
