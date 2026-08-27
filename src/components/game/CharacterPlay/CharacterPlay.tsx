'use client';

import React, { useState } from 'react';
import CharacterSheet from '@/components/game/CharacterSheet';
import EncounterCard from '@/components/game/EncounterCard';
import D7Roller from '@/components/game/D7Roller';
import { useGeolocation } from '@/hooks/useGeolocation';
import { ratingFor } from '@/lib/geolarp/character';
import { LocationMode, ZONES, useCharacterPlay } from './useCharacterPlay';

export interface CharacterPlayProps {
  /** Fixes the day, so a story or a test is not at the mercy of the clock. */
  today?: Date;
  className?: string;
}

const MODES: ReadonlyArray<{ id: LocationMode; label: string }> = [
  { id: 'gps', label: 'Use my location' },
  { id: 'zone', label: 'Pick a zone' },
  { id: 'grid', label: 'Grid movement' },
];

/**
 * The playable surface: a sheet, the cell you are in, and a roll against it.
 *
 * Location is optional by design. The published fallbacks — a hand-picked zone
 * and grid movement with no GPS at all (`the-world-is-the-board.md:93-95`) —
 * are first-class here, not a degraded path: the default is "pick a zone", so
 * the game is playable before any permission prompt appears.
 *
 * @category game
 */
export default function CharacterPlay({
  today,
  className = '',
}: CharacterPlayProps) {
  const play = useCharacterPlay(today);
  const [name, setName] = useState('');
  const geo = useGeolocation();

  // The fix is handed straight to the quantiser and never stored.
  React.useEffect(() => {
    if (play.mode !== 'gps' || !geo.position) return;
    play.setCellFromFix(
      geo.position.coords.latitude,
      geo.position.coords.longitude
    );
    // `play` is stable enough for this; the fix is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.mode, geo.position]);

  if (!play.ready) {
    return (
      <p className="text-base-content" role="status">
        Loading your character…
      </p>
    );
  }

  if (!play.character) {
    return (
      <section
        className={`card bg-base-100 border-base-300 mx-auto max-w-md border${className ? ` ${className}` : ''}`}
        aria-labelledby="begin-heading"
      >
        <div className="card-body gap-4">
          <h2
            id="begin-heading"
            className="text-base-content text-xl font-bold"
          >
            Make a character
          </h2>
          <p className="text-base-content text-sm">
            Ten seconds. Attributes and skills are rolled for you in dice codes
            — <span className="font-mono">3d7+2</span> — and the character lives
            in this browser only.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              play.begin(name);
            }}
          >
            <label
              className="text-base-content flex flex-col gap-1 text-sm"
              htmlFor="character-name"
            >
              Name
              <input
                id="character-name"
                name="character-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wanderer"
                className="input input-bordered min-h-11 w-full"
                autoComplete="off"
              />
            </label>
            <button type="submit" className="btn btn-primary min-h-11">
              Roll a character
            </button>
          </form>
        </div>
      </section>
    );
  }

  const skill = play.selectedSkill;

  return (
    <div className={`flex flex-col gap-6${className ? ` ${className}` : ''}`}>
      <section aria-labelledby="where-heading" className="flex flex-col gap-3">
        <h2 id="where-heading" className="text-base-content text-xl font-bold">
          Where you are
        </h2>

        <fieldset className="flex flex-wrap gap-2">
          <legend className="text-base-content mb-2 text-sm">
            The game only ever knows your 100-metre cell. Location is optional.
          </legend>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`btn btn-sm min-h-11 ${
                play.mode === m.id ? 'btn-primary' : 'btn-outline'
              }`}
              aria-pressed={play.mode === m.id}
              onClick={() => {
                play.setMode(m.id);
                if (m.id === 'gps') geo.getCurrentPosition();
              }}
            >
              {m.label}
            </button>
          ))}
        </fieldset>

        {play.mode === 'zone' && (
          <label
            className="text-base-content flex flex-col gap-1 text-sm"
            htmlFor="zone-select"
          >
            Zone
            <select
              id="zone-select"
              className="select select-bordered min-h-11 w-full max-w-sm"
              value={play.zoneId}
              onChange={(e) => play.setZone(e.target.value)}
            >
              {ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {play.mode === 'gps' && (
          <p className="text-base-content text-sm" role="status">
            {geo.error
              ? 'No location available — pick a zone or use grid movement instead. The game plays either way.'
              : geo.position
                ? 'Location rounded to a 100-metre cell. The precise fix was discarded.'
                : 'Waiting for a location…'}
          </p>
        )}

        {play.mode === 'grid' && (
          <div
            className="flex flex-col items-start gap-2"
            role="group"
            aria-label="Move one cell"
          >
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline min-h-11 min-w-11"
                onClick={() => play.step(0, 1)}
              >
                North
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline min-h-11 min-w-11"
                onClick={() => play.step(-1, 0)}
              >
                West
              </button>
              <button
                type="button"
                className="btn btn-outline min-h-11 min-w-11"
                onClick={() => play.step(1, 0)}
              >
                East
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline min-h-11 min-w-11"
                onClick={() => play.step(0, -1)}
              >
                South
              </button>
            </div>
          </div>
        )}
      </section>

      {play.encounter && (
        <EncounterCard encounter={play.encounter} cell={play.cell ?? undefined}>
          <p className="text-base-content text-sm">
            It suggests <strong>{play.encounter.skill}</strong>, opened on your
            sheet below — but anything you can argue for is fair.
          </p>
        </EncounterCard>
      )}

      {/*
        THE ROLLER LIVES IN THE ROW, NOT ABOVE THE SHEET.
        It used to mount inside EncounterCard, which sits two to three phone
        screens above the skill you tapped: the tap changed something the player
        could not see and nothing moved focus there. Now the row you touch opens
        under your thumb, and the encounter's own suggestion is open on arrival,
        so the common case costs zero taps.
      */}
      <CharacterSheet
        character={play.character}
        onRoll={play.selectSkill}
        expandedSkill={skill}
        renderExpanded={(s) => (
          <D7Roller
            key={`${play.encounter?.seed ?? 'no-cell'}-${s}`}
            /*
              The cell, the character and the skill. `created` is what keeps the
              roll unshared: two players standing in one cell meet the same
              encounter — that is published — and still roll their own dice.
            */
            seed={
              play.encounter
                ? `${play.encounter.seed}|${play.character!.created}|${s}`
                : undefined
            }
            restoredResult={play.result}
            label={s}
            rating={ratingFor(play.character!, s)}
            difficulty={play.encounter?.difficulty}
            availablePoints={play.character!.characterPoints}
            onResult={play.resolve}
          />
        )}
        onExport={play.exportCharacter}
        onRegenerate={play.regenerate}
      />
    </div>
  );
}
