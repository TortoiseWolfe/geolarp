/**
 * Building a character by hand.
 *
 * `generateCharacter` rolls one for a player who wants no choices. This is the
 * other path: the player spends the same two budgets themselves, and the rules
 * are checked here, in one place, so the form cannot offer something the
 * generator would never produce.
 *
 * THE BUDGETS, IN PIPS. A die is three pips (`PIPS_PER_DIE`), so the 15D
 * attribute budget is 45 pips and the 7D skill budget is 21. Counting pips is
 * what lets a player's "pips as flat adds" (`3d7+1`) come out of the same
 * budget as whole dice: a flat add is one pip of it, not a free extra.
 *
 *  - Each attribute sits between 2D and 4D, so 6 to 12 pips, and the five
 *    together spend exactly 45. The default build is five 3D attributes, which
 *    is also a complete legal character: a player who only wants to type a name
 *    and play is one tap from done.
 *  - Skills START at their attribute and are raised above it. The cap above
 *    the attribute is 1D (3 pips), except one focus that may go to 2D (6 pips),
 *    exactly the generator's rule. A player may leave budget unspent; there is
 *    no prize for holding pips back, but no reason to force a spend either.
 */
import {
  ATTRIBUTES,
  ATTRIBUTE_DICE_BUDGET,
  ATTRIBUTE_MAX_DICE,
  ATTRIBUTE_MIN_DICE,
  AttributeName,
  Character,
  SKILLS,
  SKILL_DICE_BUDGET,
  SKILL_FOCUS_MAX_OVER_ATTRIBUTE,
  SKILL_MAX_OVER_ATTRIBUTE,
  STARTING_CHARACTER_POINTS,
  SkillName,
} from './character';
import { PIPS_PER_DIE, fromPips, toPips } from './dice';

export const ATTRIBUTE_PIP_BUDGET = ATTRIBUTE_DICE_BUDGET * PIPS_PER_DIE;
export const ATTRIBUTE_PIP_MIN = ATTRIBUTE_MIN_DICE * PIPS_PER_DIE;
export const ATTRIBUTE_PIP_MAX = ATTRIBUTE_MAX_DICE * PIPS_PER_DIE;
export const SKILL_PIP_BUDGET = SKILL_DICE_BUDGET * PIPS_PER_DIE;
export const SKILL_PIP_CAP = SKILL_MAX_OVER_ATTRIBUTE * PIPS_PER_DIE;
export const SKILL_FOCUS_PIP_CAP =
  SKILL_FOCUS_MAX_OVER_ATTRIBUTE * PIPS_PER_DIE;
export const NAME_MAX = 40;
export const CONCEPT_MAX = 80;

export type AttributePips = Record<AttributeName, number>;
export type SkillPips = Partial<Record<SkillName, number>>;

/** Five 3D attributes, nothing trained. A legal character before any choice. */
export function defaultAttributePips(): AttributePips {
  const each = ATTRIBUTE_PIP_BUDGET / ATTRIBUTES.length;
  return Object.fromEntries(ATTRIBUTES.map((a) => [a, each])) as AttributePips;
}

export function attributePipsSpent(attrs: AttributePips): number {
  return ATTRIBUTES.reduce((n, a) => n + attrs[a], 0);
}

export function attributePipsLeft(attrs: AttributePips): number {
  return ATTRIBUTE_PIP_BUDGET - attributePipsSpent(attrs);
}

export function skillPipsSpent(skills: SkillPips): number {
  return Object.values(skills).reduce<number>((n, p) => n + (p ?? 0), 0);
}

export function skillPipsLeft(skills: SkillPips): number {
  return SKILL_PIP_BUDGET - skillPipsSpent(skills);
}

/** The one skill raised past 1D, if any. */
export function focusSkill(skills: SkillPips): SkillName | null {
  const over = (Object.keys(skills) as SkillName[]).filter(
    (s) => (skills[s] ?? 0) > SKILL_PIP_CAP
  );
  return over[0] ?? null;
}

/**
 * Can this attribute move one pip, in this direction? Said as a reason the
 * form can print beside a disabled button, or null when it can.
 */
export function attributeStepRefusal(
  attrs: AttributePips,
  attr: AttributeName,
  delta: 1 | -1
): string | null {
  const next = attrs[attr] + delta;
  if (next > ATTRIBUTE_PIP_MAX) return `${attr} is already at 4D, the most.`;
  if (next < ATTRIBUTE_PIP_MIN) return `${attr} is already at 2D, the least.`;
  if (delta === 1 && attributePipsLeft(attrs) <= 0) {
    return 'No attribute dice left. Lower another attribute first.';
  }
  return null;
}

/** The same question for a skill. Raising one is capped; lowering never is. */
export function skillStepRefusal(
  skills: SkillPips,
  skill: SkillName,
  delta: 1 | -1
): string | null {
  const have = skills[skill] ?? 0;
  if (delta === -1) return have <= 0 ? `${skill} is at its attribute.` : null;
  if (skillPipsLeft(skills) <= 0) return 'No skill dice left.';
  const focus = focusSkill(skills);
  const cap =
    focus === null || focus === skill ? SKILL_FOCUS_PIP_CAP : SKILL_PIP_CAP;
  if (have >= cap) {
    return focus === null || focus === skill
      ? `${skill} is at 2D over its attribute, the most.`
      : `Only one skill may go 2D over its attribute (${focus} already has).`;
  }
  return null;
}

/** Move one pip, or return the input unchanged if the rules refuse it. */
export function stepAttribute(
  attrs: AttributePips,
  attr: AttributeName,
  delta: 1 | -1
): AttributePips {
  return attributeStepRefusal(attrs, attr, delta)
    ? attrs
    : { ...attrs, [attr]: attrs[attr] + delta };
}

export function stepSkill(
  skills: SkillPips,
  skill: SkillName,
  delta: 1 | -1
): SkillPips {
  if (skillStepRefusal(skills, skill, delta)) return skills;
  const next = { ...skills, [skill]: (skills[skill] ?? 0) + delta };
  if (next[skill] === 0) delete next[skill];
  return next;
}

/** Why this build cannot be made into a character yet, or null when it can. */
export function buildRefusal(
  name: string,
  attrs: AttributePips,
  skills: SkillPips
): string | null {
  if (!name.trim()) return 'Give your character a name.';
  if (attributePipsLeft(attrs) !== 0) {
    return 'Spend all 15D of attribute dice (you can also lower one).';
  }
  if (skillPipsLeft(skills) < 0)
    return 'You have spent more than 7D on skills.';
  return null;
}

/**
 * Turn a legal build into a Character. Throws on an illegal one, because a form
 * that lets one through has a bug and a quiet bad sheet is the worse outcome.
 */
export function buildCharacter(
  name: string,
  attrs: AttributePips,
  skills: SkillPips,
  now: Date = new Date(),
  concept = ''
): Character {
  const refusal = buildRefusal(name, attrs, skills);
  if (refusal) throw new Error(refusal);

  const attributes = {} as Character['attributes'];
  for (const a of ATTRIBUTES) attributes[a] = fromPips(attrs[a]);

  const stored: Character['skills'] = {};
  for (const s of Object.keys(skills) as SkillName[]) {
    const over = skills[s] ?? 0;
    if (over > 0) stored[s] = fromPips(toPips(attributes[SKILLS[s]]) + over);
  }

  const line = concept.replace(/\s+/g, ' ').trim().slice(0, CONCEPT_MAX);
  return {
    version: 1,
    name: name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX),
    ...(line ? { concept: line } : {}),
    attributes,
    skills: stored,
    characterPoints: STARTING_CHARACTER_POINTS,
    created: now.toISOString(),
  };
}

/** "5 pips" is a hard number to feel; say it as dice and pips: 7 pips is "2D+1". */
export function formatPips(pips: number): string {
  const dice = Math.floor(pips / PIPS_PER_DIE);
  const rest = pips % PIPS_PER_DIE;
  if (dice === 0) return `${rest} pip${rest === 1 ? '' : 's'}`;
  return rest > 0 ? `${dice}D+${rest}` : `${dice}D`;
}
