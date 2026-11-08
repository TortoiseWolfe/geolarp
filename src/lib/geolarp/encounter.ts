/**
 * What is in a cell.
 *
 * "Each cell's coordinates are hashed into a seed, and that seed generates what
 * is there — a monster, a trader, a cache, a shrine, a trap. Five kinds, scaled
 * by a challenge rating tuned to the d7 curve" (`the-world-is-the-board.md:68-70`).
 *
 * Everything here is a pure function of the seed. Two players standing in the
 * same cell on the same day get the same encounter, which is the design's whole
 * point: it is "derived from the place, not handed out" (`:74-77`).
 */
import { Difficulty, LADDER } from './ladder';
import { Rng } from './rng';
import { SkillName } from './character';

export const ENCOUNTER_KINDS = [
  'monster',
  'trader',
  'cache',
  'shrine',
  'trap',
] as const;
export type EncounterKind = (typeof ENCOUNTER_KINDS)[number];

export interface Encounter {
  /** The seed it came from — displayable, and makes a bug reproducible. */
  seed: string;
  kind: EncounterKind;
  title: string;
  description: string;
  /** The skill the player rolls to resolve it. */
  skill: SkillName;
  difficulty: Difficulty;
}

interface KindProfile {
  titles: readonly string[];
  /** Skills that can plausibly resolve this kind. */
  skills: readonly SkillName[];
  describe: (title: string) => string;
}

const PROFILES: Record<EncounterKind, KindProfile> = {
  monster: {
    titles: [
      'a lean stray',
      'something with too many joints',
      'a hungry shape',
    ],
    skills: ['Brawl', 'Dodge', 'Willpower'],
    describe: (t) =>
      `You are not alone here. There is ${t}, and it has noticed you.`,
  },
  trader: {
    titles: ['a folding table', 'a pack on a wall', 'a lantern and a ledger'],
    skills: ['Persuade', 'Lore', 'Scavenge'],
    describe: (t) => `Someone has set up ${t}. They will deal, at their price.`,
  },
  cache: {
    titles: ['a loose panel', 'a tin under a step', 'a knot in the fence'],
    skills: ['Search', 'Scavenge', 'Climb'],
    describe: (t) =>
      `${t[0].toUpperCase()}${t.slice(1)} — someone left something here.`,
  },
  shrine: {
    titles: [
      'a stack of stones',
      'a mark scratched at knee height',
      'a bowl of rain',
    ],
    skills: ['Willpower', 'Lore', 'Persuade'],
    describe: (t) =>
      `${t[0].toUpperCase()}${t.slice(1)}. It was meant to be found.`,
  },
  trap: {
    titles: [
      'a wire at ankle height',
      'ground that gives',
      'a door that only opens in',
    ],
    skills: ['Dodge', 'Search', 'Stealth'],
    describe: (t) =>
      `${t[0].toUpperCase()}${t.slice(1)}. Whoever set it is still counting on it.`,
  },
};

/**
 * Challenge ratings, weighted toward the middle of the ladder.
 *
 * Heroic is deliberately rare — the ladder tops out well above what a starting
 * 3d7+skill can reach, so a Heroic cell is a thing to SAVE UP FOR rather than
 * a thing to come back to. It reseeds at midnight UTC: come back tomorrow and
 * that cell is something else. What carries over is the Character Points, and
 * spending five of them is how a starting sheet reaches a Heroic floor at all.
 */
const DIFFICULTY_WEIGHTS: ReadonlyArray<[Difficulty, number]> = [
  ['very-easy', 10],
  ['easy', 25],
  ['moderate', 30],
  ['difficult', 20],
  ['very-difficult', 12],
  ['heroic', 3],
];

function weightedDifficulty(rng: Rng): Difficulty {
  const total = DIFFICULTY_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let n = rng.int(1, total);
  for (const [id, w] of DIFFICULTY_WEIGHTS) {
    n -= w;
    if (n <= 0) return id;
  }
  return LADDER[2].id;
}

/** The encounter for a seed. Pure: same seed in, same encounter out, always. */
export function encounterFor(seed: string): Encounter {
  const rng = new Rng(seed);
  const kind = rng.pick(ENCOUNTER_KINDS);
  const profile = PROFILES[kind];
  const title = rng.pick(profile.titles);
  return {
    seed,
    kind,
    title,
    description: profile.describe(title),
    skill: rng.pick(profile.skills),
    difficulty: weightedDifficulty(rng),
  };
}
