import { describe, it, expect } from 'vitest';
import {
  Character,
  SKILLS,
  SkillName,
  generateCharacter,
  ratingFor,
  skillRating,
  saveCharacter,
  loadCharacter,
  STORAGE_KEY,
} from '@/lib/geolarp/character';
import { toPips, formatCode } from '@/lib/geolarp/dice';
import { Rng } from '@/lib/geolarp/rng';

/**
 * A skill can never roll below its governing attribute — including on a
 * character that was already saved before the map changed (#64).
 *
 * WHY THIS FILE EXISTS SEPARATELY. `tests/unit/geolarp-world.test.ts` asserts
 * the same invariant, but only against FRESHLY GENERATED characters. That is
 * the one population where it cannot fail: `generateCharacter` skips a skill
 * whose overage is zero, so a stored code is always strictly above its
 * attribute at creation. The failure this guards lives entirely in the other
 * population — characters already in a browser, re-read against a changed
 * `SKILLS` map — so a suite that only exercises generation stays green while
 * real saves violate the rule.
 *
 * Moving one skill to a different attribute is the concrete case: measured for
 * `Haggle` (Luck to Spirit), ~47% of sheets change an untrained rating and
 * ~5.2% land with a stored code strictly below its new attribute.
 */

/** A character whose stored `skill` code sits BELOW its governing attribute. */
function corruptedAt(skill: SkillName, belowByPips = 4): Character {
  const c = generateCharacter('Ada Wren', new Rng('clamp-fixture'));
  const attr = c.attributes[SKILLS[skill]];
  const under = toPips(attr) - belowByPips;
  expect(under).toBeGreaterThan(0);
  return {
    ...c,
    skills: {
      ...c.skills,
      [skill]: { dice: Math.floor(under / 3), pips: under % 3 },
    },
  };
}

describe('ratingFor clamps to the governing attribute', () => {
  it('rolls the attribute when a stored code is below it', () => {
    const c = corruptedAt('Haggle');
    const attr = c.attributes[SKILLS.Haggle];
    expect(toPips(c.skills.Haggle!)).toBeLessThan(toPips(attr));
    // The whole point: what is ROLLED is the attribute, not the stored code.
    expect(ratingFor(c, 'Haggle')).toEqual(attr);
    expect(skillRating(c, 'Haggle').inert).toBe(true);
    expect(skillRating(c, 'Haggle').trained).toBe(false);
  });

  it('is a NO-OP on every character the generator can produce', () => {
    // The clamp must not change today's behaviour. If it did, it would be a
    // silent rebalance dressed up as a bug fix.
    for (let i = 0; i < 300; i += 1) {
      const c = generateCharacter(`W${i}`, new Rng(`noop-${i}`));
      for (const skill of Object.keys(SKILLS) as SkillName[]) {
        const stored = c.skills[skill];
        const expected = stored ?? c.attributes[SKILLS[skill]];
        expect(ratingFor(c, skill)).toEqual(expected);
        expect(skillRating(c, skill).inert).toBe(false);
      }
    }
  });

  it('keeps a stored code that DOES beat its attribute', () => {
    const c = generateCharacter('Ada Wren', new Rng('keeps'));
    const trained = (Object.keys(c.skills) as SkillName[])[0];
    expect(trained).toBeDefined();
    expect(ratingFor(c, trained)).toEqual(c.skills[trained]);
    expect(skillRating(c, trained).trained).toBe(true);
  });

  it('does not DELETE the stored code, so a remap back restores it', () => {
    // Non-destructive on purpose. Clamping hides an inert code; pruning it
    // would throw away a value that becomes meaningful again if the skill is
    // remapped back or the attribute later falls.
    const c = corruptedAt('Haggle');
    const before = c.skills.Haggle;
    ratingFor(c, 'Haggle');
    expect(c.skills.Haggle).toEqual(before);
  });

  it('holds the invariant for EVERY skill on a LOADED character', () => {
    // The population geolarp-world.test.ts cannot reach: written to storage,
    // read back, and checked. This is the assertion whose absence let the
    // remap look safe.
    window.localStorage.clear();
    const c = corruptedAt('Haggle');
    saveCharacter(c);
    const loaded = loadCharacter();
    expect(loaded).not.toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('Haggle');
    for (const skill of Object.keys(SKILLS) as SkillName[]) {
      const attr = loaded!.attributes[SKILLS[skill]];
      expect(
        toPips(ratingFor(loaded!, skill)),
        `${skill} rolled ${formatCode(ratingFor(loaded!, skill))} below its attribute ${formatCode(attr)}`
      ).toBeGreaterThanOrEqual(toPips(attr));
    }
  });

  it('survives the round trip a remap would actually take', () => {
    // Simulates the sequence the ticket describes end to end: a character is
    // saved under one map, the map changes, the character is re-read. The
    // remap is modelled by storing a code that the new attribute beats.
    window.localStorage.clear();
    saveCharacter(corruptedAt('Improvise', 5));
    const loaded = loadCharacter()!;
    const attr = loaded.attributes[SKILLS.Improvise];
    expect(ratingFor(loaded, 'Improvise')).toEqual(attr);
    expect(skillRating(loaded, 'Improvise').inert).toBe(true);
  });
});
