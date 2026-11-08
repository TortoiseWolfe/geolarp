import { describe, it, expect } from 'vitest';
import {
  ATTRIBUTES,
  SKILLS,
  SKILL_DICE_BUDGET,
  ATTRIBUTE_DICE_BUDGET,
  SkillName,
  STARTING_CHARACTER_POINTS,
} from '@/lib/geolarp/character';
import {
  attributePipsLeft,
  buildCharacter,
  buildRefusal,
  defaultAttributePips,
  skillPipsLeft,
  skillPipsSpent,
  stepAttribute,
  stepSkill,
  attributeStepRefusal,
  skillStepRefusal,
  formatPips,
  SkillPips,
} from '@/lib/geolarp/creation';
import { formatCode, toPips } from '@/lib/geolarp/dice';

describe('the default build', () => {
  it('is five 3D attributes and a legal character with only a name', () => {
    const attrs = defaultAttributePips();
    expect(attributePipsLeft(attrs)).toBe(0);
    const c = buildCharacter('Ada', attrs, {});
    for (const a of ATTRIBUTES) expect(formatCode(c.attributes[a])).toBe('3d7');
    expect(c.skills).toEqual({});
    expect(c.characterPoints).toBe(STARTING_CHARACTER_POINTS);
  });

  it('refuses a missing name', () => {
    expect(buildRefusal('  ', defaultAttributePips(), {})).toMatch(/name/);
    expect(() => buildCharacter('', defaultAttributePips(), {})).toThrow();
  });
});

describe('attributes: 15D, each 2D to 4D, pips as flat adds', () => {
  it('moves a pip from one attribute to another and keeps the total at 15D', () => {
    let a = defaultAttributePips();
    a = stepAttribute(a, 'Strength', -1); // 2d7+2
    a = stepAttribute(a, 'Luck', 1); // 3d7+1
    expect(attributePipsLeft(a)).toBe(0);
    const c = buildCharacter('Ada', a, {});
    expect(formatCode(c.attributes.Strength)).toBe('2d7+2');
    expect(formatCode(c.attributes.Luck)).toBe('3d7+1');
    const total = ATTRIBUTES.reduce((n, k) => n + toPips(c.attributes[k]), 0);
    expect(total).toBe(ATTRIBUTE_DICE_BUDGET * 3);
  });

  it('will not raise with no dice left', () => {
    const a = defaultAttributePips();
    expect(attributeStepRefusal(a, 'Strength', 1)).toMatch(
      /No attribute dice left/
    );
    expect(stepAttribute(a, 'Strength', 1)).toBe(a);
  });

  it('holds every attribute between 2D and 4D', () => {
    let a = defaultAttributePips();
    for (let i = 0; i < 20; i += 1) {
      a = stepAttribute(a, 'Strength', -1);
      a = stepAttribute(a, 'Agility', 1);
    }
    expect(formatCode({ dice: 0, pips: a.Strength })).toBe('2d7');
    expect(formatCode({ dice: 0, pips: a.Agility })).toBe('4d7');
    expect(attributeStepRefusal(a, 'Strength', -1)).toMatch(/2D/);
    expect(attributeStepRefusal(a, 'Agility', 1)).toMatch(/4D/);
  });

  it('will not build while attribute dice are unspent', () => {
    const a = stepAttribute(defaultAttributePips(), 'Strength', -1);
    expect(buildRefusal('Ada', a, {})).toMatch(/15D/);
  });
});

describe('skills: 7D, start at the attribute, 1D cap, one 2D focus', () => {
  it('stores a trained skill relative to its attribute', () => {
    const skills = stepSkill(stepSkill({}, 'Search', 1), 'Search', 1);
    const c = buildCharacter('Ada', defaultAttributePips(), skills);
    expect(formatCode(c.skills.Search!)).toBe('3d7+2');
    expect(c.skills).not.toHaveProperty('Lore');
  });

  it('lets a player spend the whole 7D across the twenty skills', () => {
    // One 2D focus (6 pips) + five skills at 1D (15 pips) = 21 pips = 7D.
    let skills: SkillPips = {};
    const names = Object.keys(SKILLS) as SkillName[];
    for (let i = 0; i < 6; i += 1) skills = stepSkill(skills, names[0], 1);
    for (const s of names.slice(1, 6)) {
      for (let i = 0; i < 3; i += 1) skills = stepSkill(skills, s, 1);
    }
    expect(skillPipsSpent(skills)).toBe(SKILL_DICE_BUDGET * 3);
    expect(skillPipsLeft(skills)).toBe(0);
    expect(buildRefusal('Ada', defaultAttributePips(), skills)).toBeNull();
    expect(skillStepRefusal(skills, 'Lift', 1)).toMatch(/No skill dice left/);
  });

  it('allows only one skill past 1D', () => {
    let skills: SkillPips = {};
    for (let i = 0; i < 6; i += 1) skills = stepSkill(skills, 'Brawl', 1);
    for (let i = 0; i < 3; i += 1) skills = stepSkill(skills, 'Climb', 1);
    expect(skillStepRefusal(skills, 'Climb', 1)).toMatch(/Only one skill/);
    expect(skillStepRefusal(skills, 'Brawl', 1)).toMatch(/2D over/);
  });

  it('lowering below the attribute is refused', () => {
    expect(skillStepRefusal({}, 'Search', -1)).toMatch(/at its attribute/);
  });

  it('shows a pip total as dice', () => {
    expect(formatPips(7)).toBe('2D+1');
    expect(formatPips(2)).toBe('2 pips');
    expect(formatPips(1)).toBe('1 pip');
    expect(formatPips(6)).toBe('2D');
  });
});
