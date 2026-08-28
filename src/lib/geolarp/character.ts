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
import { DAILY_EARN_CAP } from './reward';

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

/**
 * The stake a character begins with.
 *
 * Named because the bare `5` appeared in NO specification document — not in
 * `spec.md`, not in `resolution.md`. It was an implementation invention filling
 * `resolution.md:123`'s UNSPECIFIED, and an unexplained number is one nobody
 * can justify changing later. It is also the daily cap, which is the whole
 * rule in one sentence: one day of the best possible luck refills what you
 * began with, and no more.
 */
export const STARTING_CHARACTER_POINTS = 5;

export interface Character {
  /** Schema version, so an exported file can be migrated rather than rejected. */
  version: 1;
  name: string;
  attributes: Record<AttributeName, DiceCode>;
  /** Only skills raised above their attribute are stored. */
  skills: Partial<Record<SkillName, DiceCode>>;
  /** Spendable for a reroll; D6's Character Points. */
  characterPoints: number;
  /**
   * The UTC day of the most recent earning, `YYYY-MM-DD`.
   *
   * A DATE, NOT A PLACE, and that distinction is the whole design. Capping by
   * day is what lets the "already paid for this cell" record live in memory
   * for the session — because a DURABLE record of which cells paid is a record
   * of where you have been, and `the-world-is-the-board.md:92-93` says no
   * location history is collected. The cap is what makes forgetting safe.
   */
  earnedOn?: string;
  /**
   * Points earned on `earnedOn`. Optional alongside it so `version` stays 1
   * and every character already in a browser keeps loading — `loadCharacter`
   * returning null drops the player into the name gate and destroys the sheet.
   */
  earnedToday?: number;
  /**
   * When this character was last exported FROM THIS BROWSER, ISO 8601.
   *
   * The published promise is that the game "will warn you rather than quietly
   * lose it" (`the-world-is-the-board.md:103`). A warning with no state behind
   * it is the ambient paragraph on the sheet that every player scrolls past;
   * with this, the sheet can say "you have never exported this character" at
   * the moment it is about to be destroyed, which is a warning.
   *
   * OPTIONAL ON PURPOSE, so `version` stays 1 and every character already in
   * localStorage — and every previously exported file — still loads unchanged.
   * `toExportJSON` STRIPS it: it is device-local bookkeeping, and a character
   * imported onto a new device genuinely has never been exported from there.
   */
  exportedAt?: string;
  /** ISO timestamp. */
  created: string;
}

export interface SkillRating {
  /** The code actually rolled: the stored skill, or its attribute — whichever is higher. */
  code: DiceCode;
  /** The governing attribute's own code. */
  attribute: DiceCode;
  /** A stored code exists AND beats the attribute. */
  trained: boolean;
  /**
   * A stored code exists and does NOT beat its attribute.
   *
   * `generateCharacter` cannot produce this — it skips a skill whose overage is
   * zero (`if (over === 0) continue`), so a stored code is always strictly
   * above its attribute at creation. The state arises exactly one way: a skill
   * is remapped to a different attribute, and every character already in a
   * browser is re-read against the new map.
   */
  inert: boolean;
}

/**
 * What a skill actually rolls, and whether its stored code is doing anything.
 *
 * ONE FUNCTION OWNS BOTH FACTS, DELIBERATELY. `ratingFor` used to return
 * `char.skills[skill] ?? char.attributes[...]` and `CharacterSheet` repeated
 * that lookup inline to decide what to print and whether to say "(trained)".
 * Two copies of a rule is two chances to disagree, and clamping only one of
 * them would desynchronise the number shown from the number rolled — a worse
 * bug than the one being fixed (#64).
 *
 * THE CLAMP. A skill starts AT its governing attribute and rises above it in
 * pips; a skill below its attribute is a state the system says cannot exist.
 * Rather than trust the stored value, this returns whichever is higher. That is
 * non-destructive on purpose: the stored code is kept, so a skill remapped back
 * — or an attribute that later falls — makes it meaningful again rather than
 * having silently discarded it.
 *
 * Nothing generated today changes behaviour: at creation a stored code always
 * beats its attribute, so the clamp is a no-op until the day it is not.
 */
export function skillRating(char: Character, skill: SkillName): SkillRating {
  const attribute = char.attributes[SKILLS[skill]];
  const stored = char.skills[skill];
  if (!stored) {
    return { code: attribute, attribute, trained: false, inert: false };
  }
  const beatsAttribute = toPips(stored) > toPips(attribute);
  return {
    code: beatsAttribute ? stored : attribute,
    attribute,
    trained: beatsAttribute,
    inert: !beatsAttribute,
  };
}

/** The rating actually rolled for a skill. Never below its governing attribute. */
export function ratingFor(char: Character, skill: SkillName): DiceCode {
  return skillRating(char, skill).code;
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
    characterPoints: STARTING_CHARACTER_POINTS,
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

/**
 * Pay a character for beating a cell, bounded by the daily cap.
 *
 * WHY THE DAY CAPS RATHER THAN GRANTS. The obvious design — N points refresh
 * at midnight — was rejected, and the reason is worth keeping. It runs on the
 * same clock as `seedOf`, in the opposite direction: the reseed DESTROYS the
 * world at UTC midnight while a stipend CREATES currency there, so saving five
 * days for the Heroic cell you found means arriving with five points at a cell
 * that has been gone for five days. It also makes waiting a strategy, in a
 * game whose published thesis is that it "only works if you move".
 *
 * So the day-clock gets the cap and play gets the grant. What the cap actually
 * bounds is grid mode: `step()` moves a player for free and forever from an
 * armchair, so an uncapped source would be an infinite faucet. A real walking
 * session earns two or three and never touches it.
 *
 * Writes nothing when the grant is zero, so a failed roll never touches
 * storage.
 */
export function earnCharacterPoints(
  char: Character,
  n: number,
  day: string
): Character {
  if (n <= 0) return char;

  const earnedToday = char.earnedOn === day ? (char.earnedToday ?? 0) : 0;
  const granted = Math.min(Math.max(0, n), DAILY_EARN_CAP - earnedToday);
  if (granted <= 0) {
    // Still record the day, or a character that hit the cap and then earned
    // nothing would look like it had never earned at all.
    return char.earnedOn === day
      ? char
      : { ...char, earnedOn: day, earnedToday: 0 };
  }

  return {
    ...char,
    characterPoints: char.characterPoints + granted,
    earnedOn: day,
    earnedToday: earnedToday + granted,
  };
}

/** How many points this character may still earn today. */
export function remainingEarnToday(char: Character, day: string): number {
  const earned = char.earnedOn === day ? (char.earnedToday ?? 0) : 0;
  return Math.max(0, DAILY_EARN_CAP - earned);
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
  // `exportedAt` describes THIS browser's relationship to the character, not
  // the character. Carrying it into the file would tell a new device it had
  // already been backed up there.
  //
  // `earnedOn`/`earnedToday` go the OTHER way and are deliberately kept: the
  // cap belongs to the character, so export-then-import must not be a one-click
  // way to refill it.
  const { exportedAt: _exportedAt, ...portable } = char;
  return JSON.stringify(portable, null, 2);
}

/** Record that the player has just taken a copy. */
export function markExported(
  char: Character,
  when: Date = new Date()
): Character {
  return { ...char, exportedAt: when.toISOString() };
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
