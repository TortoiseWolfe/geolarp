'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import CharacterSheet, { skillRowId } from '@/components/game/CharacterSheet';
import EncounterCard from '@/components/game/EncounterCard';
import D7Roller from '@/components/game/D7Roller';
import CellGrid from '@/components/game/CellGrid';
import { LocationButton } from '@/components/map/LocationButton';
import { useGeolocation } from '@/hooks/useGeolocation';
import { CELL_METRES } from '@/lib/geolarp/cell';
import { placeName } from '@/lib/geolarp/place';
import { getGeolocationErrorMessage } from '@/utils/map-utils';
import { ratingFor } from '@/lib/geolarp/character';
import { LocationMode, ZONES, useCharacterPlay } from './useCharacterPlay';

export interface CharacterPlayProps {
  /** Fixes the day, so a story or a test is not at the mercy of the clock. */
  today?: Date;
  className?: string;
}

/**
 * The repo's disclosure look, lifted from the one `BlogContent` renders for
 * markdown `<details>`: bordered card, `bg-base-200`, bold `p-4` summary, a
 * rule under the summary once open. Two additions, because a bare `<summary>`
 * has neither: `min-h-11` for the 44px target and `cursor-pointer`.
 *
 * `hover:bg-base-300` is deliberately absent — the AAA sweep cannot reach a
 * hover state, so a hover colour would ship unverified on both themes.
 */
const DISCLOSURE =
  'border-base-300 bg-base-200 [&[open]>summary]:border-base-300 rounded-lg border [&[open]>summary]:border-b';
const DISCLOSURE_SUMMARY =
  'text-base-content flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 p-4 font-semibold';

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

  // Already a cell centre by the time it gets here (#39): the hook now returns a
  // CoarseFix, and the rounding happened in the callback the platform invoked.
  // Passing the centre back through `setCellFromFix` is provably identical to
  // passing the reading — `cellOf(cellCentre(cellOf(p))) === cellOf(p)`, asserted
  // in tests/unit/coarse-fix.test.ts — so the encounter seed is unchanged.
  React.useEffect(() => {
    if (play.mode !== 'gps' || !geo.fix) return;
    play.setCellFromFix(geo.fix.lat, geo.fix.lon);
    // `play` is stable enough for this; the fix is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.mode, geo.fix]);

  /**
   * THE RULES PRIMER, AND THE CHARACTER RECORD AS ITS VISIT MEMORY.
   *
   * It sat unconditionally on the route as six lines of standing prose that a
   * returning player had already read. Open for someone with no character,
   * closed for someone with one — which needs no second `localStorage` key,
   * and that matters: `/privacy-controls` preserves exactly ONE key by name,
   * so a `geolarp_intro_seen` flag would be destroyed there without a word.
   *
   * It is also the right semantics. Discard your character and you are a new
   * player again, so the rules re-open by themselves.
   */
  const primer = (
    <details open={!play.character} className={DISCLOSURE}>
      <summary className={DISCLOSURE_SUMMARY}>How geoLARP works</summary>
      <div className="text-base-content flex flex-col gap-2 p-4 pt-3 text-sm">
        <p>
          geoLARP runs on a seven-sided die. Ratings are dice codes with pips —{' '}
          <span className="font-mono">3d7+2</span> — and one die in every pool
          is wild: on a seven it explodes, on a one something goes wrong anyway.
        </p>
        <p>
          The world is a grid of 100-metre cells, and what is in a cell comes
          from the place and the date, so everyone standing there today meets
          the same thing.
        </p>
        <p>
          There are no turns. One cell, one encounter, one roll that means
          something — then walk to the next one.
        </p>
        <p>A cell suggests a skill, but anything you can argue for is fair.</p>
      </div>
    </details>
  );

  /**
   * SAFETY COPY, AND IT IS DELIBERATELY NOT IN THE DISCLOSURE ABOVE (#89).
   *
   * The primer is a `<details>` that is `open` only when no character exists, so
   * a returning player never sees it again. That is right for rules and wrong for
   * this: a notice nobody reads twice has the same shape as a check that never
   * runs, which this repo treats as worse than none at all. So it renders in
   * every state, unconditionally — and it is the only thing on the play surface
   * that says any of it. Measured before writing: no `safety`, `surroundings` or
   * `traffic` string existed anywhere under src/app/{character,map,game} or
   * src/components/game.
   *
   * It STATES "13 and over" rather than gating on an age. The minimum is binding
   * in the terms, and there is no account, birthdate or profile here to check one
   * against — an input asking a child to type a number is not a gate, it is a
   * prompt to type a different number.
   */
  const safety = (
    <p
      className="border-base-300 bg-base-200 text-base-content rounded-lg border p-3 text-sm"
      data-testid="play-safety"
    >
      <strong>Eyes up.</strong> geoLARP suggests places; it does not know what
      is there and it is not watching out for you. Obey traffic laws, respect
      private property, and decide for yourself whether somewhere is safe to go
      and when. You never have to travel &mdash; grid movement plays the whole
      game. For players 13 and over; see the{' '}
      <Link href="/terms" className="link-hover link">
        terms
      </Link>
      .
    </p>
  );

  if (!play.ready) {
    return (
      <p className="text-base-content" role="status">
        Loading your character…
      </p>
    );
  }

  if (!play.character) {
    return (
      <div className={`flex flex-col gap-6${className ? ` ${className}` : ''}`}>
        {primer}
        {safety}
        <section
          className="card bg-base-100 border-base-300 mx-auto w-full max-w-md border"
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
              Ten seconds. Attributes and skills are rolled for you in dice
              codes — <span className="font-mono">3d7+2</span> — and the
              character lives in this browser only.
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
      </div>
    );
  }

  const skill = play.selectedSkill;

  /**
   * The status is PROMOTED INTO THE SUMMARY, so collapsing the section costs
   * the player nothing they were reading. A disclosure whose summary is only
   * its own title makes you open it to find out whether you need to.
   */
  const whereSummary = play.cell
    ? // THE PLACE NAME IS THE ANSWER TO THE QUESTION ACTUALLY ASKED.
      // "Not seeing a mapping compass for where my character is at" is not a
      // request for coordinates — `-77750:39012` is precise, shareable and
      // completely unsayable. "Low Gate" is a sentence.
      placeName(play.cell)
    : play.mode === 'gps' && geo.error
      ? 'No location — playing without it'
      : // NOT the body's "Waiting for a location…". A summary that repeats its
        // own body word for word is the duplication this pass exists to
        // remove, and it makes every test matching that phrase ambiguous
        // between two elements.
        'Locating…';

  return (
    <div className={`flex flex-col gap-6${className ? ` ${className}` : ''}`}>
      {primer}
      {safety}

      {/*
        The heading stays INSIDE the summary and the labelled section stays
        outside it, so the h2 the accessibility test counts is still an h2 and
        still names this region. `<summary>` takes phrasing content
        "optionally intermixed with heading content", so this is the shape the
        spec is written for rather than one it tolerates.
      */}
      <section aria-labelledby="where-heading">
        <details className={DISCLOSURE}>
          <summary className={DISCLOSURE_SUMMARY}>
            <h2
              id="where-heading"
              className="text-base-content inline text-lg font-bold"
            >
              Where you are
            </h2>
            <span className="text-base-content text-sm font-normal">
              {whereSummary}
            </span>
          </summary>

          <div className="flex flex-col gap-3 p-4 pt-3">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="text-base-content mb-2 text-sm">
                The game only ever knows your 100-metre cell. Location is
                optional.
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
              <p
                className="text-base-content text-sm"
                role="status"
                aria-label="Location status"
              >
                {geo.error
                  ? // The specific cause, from the shared helper, instead of
                    // one flat string for four different failures — a denied
                    // permission and a timeout need different things done
                    // about them. The reassurance stays attached: the game
                    // plays either way, and that is the part a player needs
                    // in the same breath as the bad news.
                    `${getGeolocationErrorMessage(geo.error)} Pick a zone or use grid movement instead. The game plays either way.`
                  : geo.fix
                    ? 'Location rounded to a 100-metre cell. The precise fix was discarded.'
                    : 'Waiting for a location…'}
              </p>
            )}

            {play.mode === 'gps' && (
              /*
                EXPLICIT REFRESH RATHER THAN `watch: true`.
                A watch would be the obvious upgrade and it would expose a live
                bug first: GPS jitter across a cell boundary flips the cell,
                and the effect that reacts to a new cell wipes the open roll
                panel. So the player asks, and the app answers — one fix per
                press, which is also one prompt per press rather than a stream.
              */
              <LocationButton
                onClick={geo.getCurrentPosition}
                loading={geo.loading}
                hasLocation={Boolean(geo.fix)}
                permissionState={geo.permission}
                variant="secondary"
                size="sm"
              />
            )}

            {/*
              The accuracy figure was captured by `useGeolocation` and never
              read. Above half a cell the fix cannot say which cell you are in,
              and saying so is better than quietly showing the wrong one.

              `geo.accuracy` is a scalar radius, and it is the ONE thing kept from
              the reading (#39) — it says how uncertain the fix was without saying
              where it was. Measured: at a 100 m radius the assigned cell is the
              true cell about one time in seven, so this warning is load-bearing
              rather than decorative.
            */}
            {play.mode === 'gps' &&
              geo.accuracy !== null &&
              geo.accuracy > CELL_METRES / 2 && (
                <p className="text-base-content text-sm">
                  Your location is accurate to about ±{Math.round(geo.accuracy)}{' '}
                  m, so this may not be your cell.
                </p>
              )}
          </div>
        </details>
      </section>

      {/*
        THE GRID LIVES OUTSIDE THE DISCLOSURE, and that is a deliberate
        exception to the collapse pass. What was cut was PROSE the player had
        already read; this is the answer to the other half of the same
        playtest note — "not seeing a mapping compass for where my character is
        at" — and an answer one tap out of sight is not an answer.
      */}
      {play.cell && (
        <div className="flex flex-col gap-2">
          <CellGrid
            centre={play.cell}
            today={today}
            onStep={play.mode === 'grid' ? play.step : undefined}
          />

          {/*
            THE SWITCH THAT ARMS THE GRID WAS NOT NEXT TO THE GRID (#139).

            The mode buttons live inside the collapsed "Where you are" disclosure, and
            the grid deliberately sits outside it (see the comment above). So the control
            was on screen and the thing that makes it work was not, which is most of why
            the screen reads as having nothing to do.

            ZONE ONLY, NOT GPS. Under GPS the tiles are inert because the player moves by
            walking, which is the published promise; offering to switch them to armchair
            stepping there would undercut it. The dashed border is what explains the inert
            state in that mode.

            Named "Step the grid" rather than anything containing "grid movement":
            Playwright's `name:` substring-matches by default, so the latter would collide
            with `getByRole('button', { name: 'Grid movement' })` in four specs.
          */}
          {play.mode === 'zone' && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base-content text-sm">
                These are the six cells around this zone. Stepping is off.
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm min-h-11"
                onClick={() => play.setMode('grid')}
              >
                Step the grid
              </button>
            </div>
          )}

          {play.offset && (
            <p
              className="text-base-content text-sm"
              role="status"
              aria-label="Grid position"
            >
              {/*
                ROUNDED (#87). These were whole multiples of 100 on the square
                grid, so printing them raw looked fine. On the hex lattice east
                comes in halves and north in units of 86.60254037844386, and the
                unrounded value renders as "86.60254037844386 m north" — a number
                that implies a precision the grid does not carry, on the one
                screen whose whole point is that it does not.
              */}
              {Math.round(Math.abs(play.offset.east)) > 0 &&
                `${Math.round(Math.abs(play.offset.east))} m ${
                  play.offset.east > 0 ? 'east' : 'west'
                }`}
              {Math.round(Math.abs(play.offset.east)) > 0 &&
                Math.round(Math.abs(play.offset.north)) > 0 &&
                ' and '}
              {Math.round(Math.abs(play.offset.north)) > 0 &&
                `${Math.round(Math.abs(play.offset.north))} m ${
                  play.offset.north > 0 ? 'north' : 'south'
                }`}
              {` of where you started — ${play.offset.metres} m, ${play.offset.bearing}.`}
            </p>
          )}

          {play.mode === 'grid' && (
            <p className="text-base-content text-xs">
              {/* Said plainly, because the alternative is a player believing
                  the game thinks they walked somewhere. */}
              Grid movement walks the map, not you.
            </p>
          )}

          {/*
            GRID ONLY, EVEN THOUGH `offset` NOW EXISTS IN GPS MODE TOO (#140).

            `resetToOrigin` sets the cell back to the anchor. In grid mode nothing
            contradicts it. Under GPS the next fix overwrites the cell within seconds,
            so the button would appear to work, snap back, and tell a walking player
            the game had moved them somewhere they are not. The distance line is the
            honest way back for someone on foot: it already carries the metres and the
            bearing.
          */}
          {play.offset && play.mode === 'grid' && (
            <button
              type="button"
              className="btn btn-outline btn-sm min-h-11 self-start"
              onClick={play.resetToOrigin}
            >
              Back to where I started
            </button>
          )}
        </div>
      )}

      {play.encounter && (
        <EncounterCard encounter={play.encounter} cell={play.cell ?? undefined}>
          {/*
            A CONTROL, NOT A SENTENCE POINTING AT ONE.

            This slot used to read "It suggests Search, opened on your sheet
            below" — which named the skill the card already implied and then
            asked the player to go find it, two or three phone screens down.
            The button does the going.
          */}
          <button
            type="button"
            className="btn btn-outline min-h-11 self-start"
            onClick={() => {
              const suggested = play.encounter!.skill;
              play.selectSkill(suggested);
              /*
                Focus moves with the selection, or the tap changes something
                the player cannot see — the same defect the note below the
                sheet describes. The row button exists whether or not it is
                expanded, so this needs no frame delay.
              */
              document.getElementById(skillRowId(suggested))?.focus();
            }}
          >
            Go to {play.encounter.skill}
          </button>
        </EncounterCard>
      )}

      {/*
        THE ROLLER LIVES IN THE ROW, NOT ABOVE THE SHEET.
        It used to mount inside EncounterCard, which sits two to three phone
        screens above the skill you tapped: the tap changed something the player
        could not see and nothing moved focus there. Now the row you touch opens
        under your thumb.

        NOTHING IS OPEN ON ARRIVAL (#63). This used to add "and the encounter's
        own suggestion is open on arrival, so the common case costs zero taps" —
        true, and the reason the suggestion silently collected the payout, since
        a cell pays only its first resolution. `Go to {skill}` above is the
        replacement: the same one tap, made by the player.
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
