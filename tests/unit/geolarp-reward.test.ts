/**
 * The economy: what a cell pays, and how much a day can pay (#42).
 *
 * These exist because the loop was open at both ends — `resolve` never read
 * `success`, and no code path anywhere increased `characterPoints`. A
 * playtester spent all five against a Heroic cell and discovered the game was
 * finite.
 */
import { describe, it, expect } from 'vitest';
import {
  DAILY_EARN_CAP,
  REWARD_BY_BAND,
  rewardFor,
} from '@/lib/geolarp/reward';
import {
  STARTING_CHARACTER_POINTS,
  earnCharacterPoints,
  generateCharacter,
  remainingEarnToday,
  fromExportJSON,
  toExportJSON,
} from '@/lib/geolarp/character';
import { LADDER, bandOf, Difficulty } from '@/lib/geolarp/ladder';
import { roll } from '@/lib/geolarp/dice';
import { encounterFor } from '@/lib/geolarp/encounter';
import { Rng } from '@/lib/geolarp/rng';
import { utcDay } from '@/lib/geolarp/cell';

const winAt = (
  band: Difficulty,
  outcome: 'normal' | 'critical' | 'complication' = 'normal'
) => ({
  faces: [4, 4, 4],
  total: bandOf(band).floor,
  pips: 0,
  bonusDice: 0,
  wild: outcome === 'critical' ? 7 : outcome === 'complication' ? 1 : 4,
  outcome,
  success: true,
});

describe('what a cell pays', () => {
  it('pays nothing for a failure, whatever the band', () => {
    for (const band of LADDER) {
      expect(rewardFor(band.id, { ...winAt(band.id), success: false })).toBe(0);
    }
  });

  it('pays nothing when there was no target to beat', () => {
    // `success` is undefined when no difficulty was supplied. A missing target
    // must never read as a win.
    const r = { ...winAt('heroic'), success: undefined };
    expect(rewardFor('heroic', r)).toBe(0);
  });

  it('pays nothing for trivial cells, so walking anywhere beats walking next door', () => {
    expect(rewardFor('very-easy', winAt('very-easy'))).toBe(0);
    expect(rewardFor('easy', winAt('easy'))).toBe(0);
  });

  it('pays more for harder bands', () => {
    expect(rewardFor('moderate', winAt('moderate'))).toBe(1);
    expect(rewardFor('difficult', winAt('difficult'))).toBe(1);
    expect(rewardFor('very-difficult', winAt('very-difficult'))).toBe(2);
    expect(rewardFor('heroic', winAt('heroic'))).toBe(3);
  });

  it('a complication pays nothing even on a success', () => {
    // This is what makes EncounterCard's "something goes wrong either way"
    // a rule instead of flavour text.
    for (const band of LADDER) {
      expect(rewardFor(band.id, winAt(band.id, 'complication'))).toBe(0);
    }
  });

  it('an exploding wild die pays one more — but never turns a zero into a win', () => {
    expect(rewardFor('moderate', winAt('moderate', 'critical'))).toBe(2);
    expect(rewardFor('heroic', winAt('heroic', 'critical'))).toBe(4);
    // The gate: trivial cells stay worthless even on a seven, or a third of
    // the map becomes a slot machine.
    expect(rewardFor('very-easy', winAt('very-easy', 'critical'))).toBe(0);
    expect(rewardFor('easy', winAt('easy', 'critical'))).toBe(0);
  });

  it('every band in the ladder has a reward', () => {
    // A new band must not silently pay undefined.
    for (const band of LADDER) {
      expect(typeof REWARD_BY_BAND[band.id]).toBe('number');
    }
  });
});

describe('the daily cap', () => {
  const day = '2026-08-27';
  const base = () => generateCharacter('Ada', new Rng('cap'));

  it('starts a character at the documented stake', () => {
    expect(base().characterPoints).toBe(STARTING_CHARACTER_POINTS);
    expect(STARTING_CHARACTER_POINTS).toBe(DAILY_EARN_CAP);
  });

  it('pays, and records the day', () => {
    const c = earnCharacterPoints(base(), 2, day);
    expect(c.characterPoints).toBe(STARTING_CHARACTER_POINTS + 2);
    expect(c.earnedOn).toBe(day);
    expect(c.earnedToday).toBe(2);
  });

  it('never pays past the cap in one day', () => {
    let c = base();
    for (let i = 0; i < 10; i += 1) c = earnCharacterPoints(c, 3, day);
    expect(c.earnedToday).toBe(DAILY_EARN_CAP);
    expect(c.characterPoints).toBe(STARTING_CHARACTER_POINTS + DAILY_EARN_CAP);
  });

  it('resets when the UTC day turns', () => {
    let c = earnCharacterPoints(base(), DAILY_EARN_CAP, day);
    expect(remainingEarnToday(c, day)).toBe(0);
    c = earnCharacterPoints(c, 3, '2026-08-28');
    expect(c.earnedToday).toBe(3);
    expect(remainingEarnToday(c, '2026-08-28')).toBe(DAILY_EARN_CAP - 3);
  });

  it('writes nothing at all for a zero grant', () => {
    // A failed roll must not touch storage.
    const c = base();
    expect(earnCharacterPoints(c, 0, day)).toBe(c);
    expect(earnCharacterPoints(c, -3, day)).toBe(c);
  });

  it('keeps the ledger in the export, unlike exportedAt', () => {
    // Otherwise export-then-import is a one-click cap reset.
    const c = earnCharacterPoints(base(), DAILY_EARN_CAP, day);
    const back = fromExportJSON(toExportJSON(c));
    expect(back.earnedOn).toBe(day);
    expect(back.earnedToday).toBe(DAILY_EARN_CAP);
    expect(back.exportedAt).toBeUndefined();
  });

  it('loads a stored character that predates the ledger', () => {
    const legacy = base();
    delete (legacy as { earnedOn?: string }).earnedOn;
    delete (legacy as { earnedToday?: number }).earnedToday;
    expect(legacy.version).toBe(1);
    expect(remainingEarnToday(legacy, day)).toBe(DAILY_EARN_CAP);
    expect(earnCharacterPoints(legacy, 1, day).characterPoints).toBe(
      STARTING_CHARACTER_POINTS + 1
    );
  });

  it('uses the same day definition as the world', () => {
    // seedOf and the ledger must never disagree about when the day turned.
    const d = new Date('2026-08-27T23:59:59.000Z');
    expect(utcDay(d)).toBe('2026-08-27');
    expect(utcDay(new Date('2026-08-28T00:00:01.000Z'))).toBe('2026-08-28');
  });
});

describe('the economy does not silently drift', () => {
  /** Points per encounter for a given rating and stake, over the real world. */
  function simulate(dice: number, stake: number, n = 60_000): number {
    const rng = new Rng(`economy-${dice}-${stake}`);
    let total = 0;
    for (let i = 0; i < n; i += 1) {
      const e = encounterFor(`sim-${i}@2026-08-27`);
      const r = roll({ dice, pips: 0 }, rng, bandOf(e.difficulty).floor, stake);
      total += rewardFor(e.difficulty, r);
    }
    return total / n;
  }

  it('pays a starting character 0.23 to 0.39 per encounter, by rating', () => {
    // FALSIFIER, and deliberately two-ended. The band weights in encounter.ts
    // and the reward table here are two halves of one number and nothing else
    // would notice if either moved — but a single loose range would hide a
    // real shift. Measured: 3d7 (an untrained skill rolling its attribute)
    // pays 0.229; 4d7 (a trained one) pays 0.390. Those bracket what a real
    // starting sheet rolls, so an 8-cell walk earns roughly 2 to 3.
    expect(simulate(3, 0)).toBeGreaterThan(0.2);
    expect(simulate(3, 0)).toBeLessThan(0.26);
    expect(simulate(4, 0)).toBeGreaterThan(0.36);
    expect(simulate(4, 0)).toBeLessThan(0.42);
  });

  it('earns almost everything from Moderate cells', () => {
    // The band the ladder was calibrated on (resolution.md:43) should be where
    // the income is. If this ever inverts, the difficulty weighting moved.
    const rng = new Rng('by-band');
    const N = 40_000;
    const byBand: Record<string, number> = {};
    for (let i = 0; i < N; i += 1) {
      const e = encounterFor(`band-${i}@2026-08-27`);
      const r = roll({ dice: 4, pips: 0 }, rng, bandOf(e.difficulty).floor);
      byBand[e.difficulty] =
        (byBand[e.difficulty] ?? 0) + rewardFor(e.difficulty, r);
    }
    expect(byBand['moderate']).toBeGreaterThan(byBand['difficult'] ?? 0);
    expect(byBand['very-easy'] ?? 0).toBe(0);
    expect(byBand['easy'] ?? 0).toBe(0);
  });

  it('makes every stake a net loss, so points come from walking', () => {
    // If a stake ever paid for itself the sink would become a farm. Measured
    // at 4d7: stake 2 earns 0.635 against 2 spent.
    for (const stake of [1, 2, 3]) {
      expect(simulate(4, stake, 30_000)).toBeLessThan(stake);
    }
  });
});
