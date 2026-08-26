/**
 * The character model.
 *
 * Attributes and skills are DICE CODES WITH PIPS, as in West End Games' D6 —
 * `3d7+2`, not a number from 1 to 7. The blog's line that attributes "sit on
 * the same 1-7 scale as the die" (`the-world-is-the-board.md:53-55`) does not
 * describe this system and is recorded as wrong in
 * `features/enhancements/052-character-model/resolution.md` §4.
 *
 * A character is BROWSER-LOCAL by published promise: "Nothing about you goes to
 * a server, which is also why **you** are responsible for that export"
 * (`:101-103`). Nothing here touches Supabase.
 */
import { DiceCode, formatCode, fromPips, normalise, toPips } from './dice';
import { Rng } from './rng';

/** The five published attributes, in the blog's order (`:52-53`). */
export const ATTRIBUTES = [
  'Strength',
  'Agility',
  'Intellect',
  'Spirit',
  'Luck',
] as const;
export type AttributeName = (typeof ATTRIBUTES)[number];

/**
 * Skills, each governed by an attribute. A skill is never rolled on its own —
 * it starts AT its attribute and rises from there, so an untrained character
 * still rolls the attribute.
 *
 * FOUR PER ATTRIBUTE IS A BUDGET DECISION, NOT A FLOURISH. The creation budget
 * is 7D = 21 pips. Against the nine skills this started with, 21 pips saturated
 * almost every one of them — every character came out with the whole list
 * raised, and two characters differed only in the rounding. D6 spends the same
 * 7D across dozens of skills, which is what makes the choice mean something.
 * Twenty skills leaves roughly two thirds of the sheet untrained, so what a
 * player did pick reads as a decision.
 */
export const SKILLS: Readonly<Record<string, AttributeName>> = {
  // Strength
  Brawl: 'Strength',
  Climb: 'Strength',
  Lift: 'Strength',
  Stamina: 'Strength',
  // Agility
  Dodge: 'Agility',
  Stealth: 'Agility',
  Throw: 'Agility',
  Sprint: 'Agility',
  // Intellect
  Search: 'Intellect',
  Lore: 'Intellect',
  Repair: 'Intellect',
  Navigate: 'Intellect',
  // Spirit
  Persuade: 'Spirit',
  Willpower: 'Spirit',
  Command: 'Spirit',
  Intimidate: 'Spirit',
  // Luck
  Scavenge: 'Luck',
  Gamble: 'Luck',
  Haggle: 'Luck',
  Improvise: 'Luck',
};
export type SkillName = keyof typeof SKILLS;

/** D6 gives 18D over six attributes; five attributes at the same 3D average. */
export const ATTRIBUTE_DICE_BUDGET = 15;
export const ATTRIBUTE_MIN_DICE = 2;
export const ATTRIBUTE_MAX_DICE = 4;
/** Pips to spend on skills at creation: 7D. */
export const SKILL_DICE_BUDGET = 7;
/**
 * How many skills a generated character trains. The floor is set by capacity:
 * 21 pips against a 1D cap needs at least a 2D focus plus five more skills to
 * be spendable at all. The ceiling keeps a sheet readable and a character
 * recognisable.
 */
export const SKILL_TRAINED_MIN = 6;
export const SKILL_TRAINED_MAX = 8;
/** Max dice a single skill may rise above its attribute... */
export const SKILL_MAX_OVER_ATTRIBUTE = 1;
/** ...except one focus, which may go to 2D. */
export const SKILL_FOCUS_MAX_OVER_ATTRIBUTE = 2;

export interface Character {
  /** Schema version, so an exported file can be migrated rather than rejected. */
  version: 1;
  name: string;
  attributes: Record<AttributeName, DiceCode>;
  /** Only skills raised above their attribute are stored. */
  skills: Partial<Record<SkillName, DiceCode>>;
  /** Spendable for a reroll; D6's Character Points. */
  characterPoints: number;
  /** ISO timestamp. */
  created: string;
}

/** The rating actually rolled for a skill: its own, or its attribute's. */
export function ratingFor(char: Character, skill: SkillName): DiceCode {
  return char.skills[skill] ?? char.attributes[SKILLS[skill]];
}

/**
 * Generate a character.
 *
 * The target is ten seconds of a player's time (`:99`), so this asks for
 * nothing and produces a complete, legal sheet. Every die is allocated: the
 * budgets are spent exactly, not approximately.
 */
export function generateCharacter(
  name: string,
  rng: Rng = new Rng(Math.floor(Math.random() * 0xffffffff))
): Character {
  // Start everyone at the floor, then distribute what is left one die at a time.
  const dice: Record<string, number> = {};
  for (const a of ATTRIBUTES) dice[a] = ATTRIBUTE_MIN_DICE;
  let remaining =
    ATTRIBUTE_DICE_BUDGET - ATTRIBUTE_MIN_DICE * ATTRIBUTES.length;
  while (remaining > 0) {
    const open = ATTRIBUTES.filter((a) => dice[a] < ATTRIBUTE_MAX_DICE);
    dice[rng.pick(open)] += 1;
    remaining -= 1;
  }

  const attributes = {} as Record<AttributeName, DiceCode>;
  for (const a of ATTRIBUTES) attributes[a] = { dice: dice[a], pips: 0 };

  // Skills. A player does not sprinkle 7D evenly over the whole list — they
  // pick a handful and commit. Spreading pips uniformly across all 20 skills
  // produced characters that were identical generalists, differing only in
  // rounding, so the generator chooses a small trained set first and fills
  // only that.
  const names = Object.keys(SKILLS) as SkillName[];
  const trainedCount = rng.int(SKILL_TRAINED_MIN, SKILL_TRAINED_MAX);
  const pool = [...names];
  const trained: SkillName[] = [];
  for (let i = 0; i < trainedCount; i += 1) {
    trained.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  }
  const focus = trained[0];

  const overPips: Partial<Record<SkillName, number>> = {};
  let skillPips = SKILL_DICE_BUDGET * 3;
  while (skillPips > 0) {
    const open = trained.filter((s) => {
      const cap =
        (s === focus
          ? SKILL_FOCUS_MAX_OVER_ATTRIBUTE
          : SKILL_MAX_OVER_ATTRIBUTE) * 3;
      return (overPips[s] ?? 0) < cap;
    });
    if (open.length === 0) break; // budget exceeds what the caps allow
    const s = rng.pick(open);
    overPips[s] = (overPips[s] ?? 0) + 1;
    skillPips -= 1;
  }

  const skills: Partial<Record<SkillName, DiceCode>> = {};
  for (const s of trained) {
    const over = overPips[s] ?? 0;
    if (over === 0) continue;
    skills[s] = fromPips(toPips(attributes[SKILLS[s]]) + over);
  }

  return {
    version: 1,
    name,
    attributes,
    skills,
    characterPoints: 5,
    created: new Date().toISOString(),
  };
}

/**
 * Raise a rating by pips. `Xd7+3` becomes `(X+1)d7` — that is the whole of
 * advancement, and it is why `normalise` exists.
 */
export function advance(code: DiceCode, pips: number): DiceCode {
  return normalise({ dice: code.dice, pips: code.pips + pips });
}

/**
 * Spend Character Points. Returns the updated character; the caller passes the
 * same count to `roll` as `bonusDice`. Spending more than you have is a bug in
 * the caller, not a house rule, so it throws.
 */
export function spendCharacterPoints(char: Character, n: number): Character {
  if (n < 0) throw new Error('cannot spend a negative number of points');
  if (n > char.characterPoints) {
    throw new Error(`only ${char.characterPoints} Character Points remain`);
  }
  return { ...char, characterPoints: char.characterPoints - n };
}

export const STORAGE_KEY = 'geolarp_character';

export function loadCharacter(): Character | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Character;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCharacter(char: Character): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(char));
}

/** The export the published promise makes the player responsible for (`:101`). */
export function toExportJSON(char: Character): string {
  return JSON.stringify(char, null, 2);
}

export function fromExportJSON(text: string): Character {
  const parsed = JSON.parse(text) as Character;
  if (parsed?.version !== 1) throw new Error('not a geoLARP character file');
  for (const a of ATTRIBUTES) {
    if (!parsed.attributes?.[a]) throw new Error(`missing attribute: ${a}`);
  }
  return parsed;
}

/** Human-readable sheet line, e.g. "Strength 3d7+1". */
export function formatRating(name: string, code: DiceCode): string {
  return `${name} ${formatCode(code)}`;
}
