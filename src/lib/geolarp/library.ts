/**
 * The local library: more than one character on one device.
 *
 * LOCAL-ONLY, BY THE PUBLISHED PROMISE. Everything here reads and writes a
 * `CharacterStore` (`localStorage` in a browser) and nothing else. There is no
 * account, no sync and no network call in this file, and
 * `tests/unit/play-local-only.test.ts` fails if one is added.
 *
 * TWO KEYS, AND THE OLD ONE STAYS TRUE. The library lives under
 * `LIBRARY_KEY`. The ACTIVE character is also mirrored to the original
 * `STORAGE_KEY`, so `/character`, `/privacy-controls` and every character
 * already in a browser keep working without being migrated away from. A browser
 * that has only the old key gets that character adopted into the library the
 * first time it is read; nothing is deleted.
 *
 * A character's id is its `created` timestamp. It is already unique per sheet,
 * survives export and import unchanged, and needs no second field.
 */
import {
  ATTRIBUTES,
  Character,
  CharacterStore,
  HISTORY_LIMIT,
  HistoryEntry,
  SKILLS,
  SkillName,
  STORAGE_KEY,
  fromExportJSON,
  loadCharacter,
  saveCharacter,
} from './character';
import { DiceCode } from './dice';

export const LIBRARY_KEY = 'geolarp_characters';

/** A phone's storage is small and a library is not a vault. */
export const LIBRARY_LIMIT = 20;

export interface Library {
  version: 1;
  /** `created` of the character on screen, or null for an empty library. */
  activeId: string | null;
  characters: Character[];
}

const EMPTY: Library = { version: 1, activeId: null, characters: [] };

/** The one store a library needs: the same string store a single character uses. */
export function defaultStore(): CharacterStore | undefined {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return {
        getItem: (k) => window.localStorage.getItem(k),
        setItem: (k, v) => window.localStorage.setItem(k, v),
        removeItem: (k) => window.localStorage.removeItem(k),
      };
    }
  } catch {
    // Blocked site data: fall through to "no store".
  }
  return undefined;
}

export function loadLibrary(store: CharacterStore): Library {
  let library: Library = EMPTY;
  try {
    const raw = store.getItem(LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Library;
      if (parsed?.version === 1 && Array.isArray(parsed.characters)) {
        library = {
          version: 1,
          activeId: parsed.activeId ?? null,
          characters: parsed.characters.filter((c) => c?.version === 1),
        };
      }
    }
  } catch {
    // A corrupt library reads as empty, never as a crash on the route that
    // holds the player's characters.
  }

  // Adopt the single character a browser may already hold.
  const legacy = loadCharacter(store);
  if (legacy && !library.characters.some((c) => c.created === legacy.created)) {
    library = {
      ...library,
      characters: [...library.characters, legacy],
      activeId: library.activeId ?? legacy.created,
    };
  }

  if (
    library.activeId &&
    !library.characters.some((c) => c.created === library.activeId)
  ) {
    library = { ...library, activeId: library.characters[0]?.created ?? null };
  }
  return library;
}

export function saveLibrary(library: Library, store: CharacterStore): void {
  try {
    store.setItem(LIBRARY_KEY, JSON.stringify(library));
    const active = activeCharacter(library);
    if (active) saveCharacter(active, store);
    else store.removeItem(STORAGE_KEY);
  } catch {
    // A refused write (quota, private mode) leaves the in-memory library
    // playing; the published promise is that the player owns the export.
  }
}

export function activeCharacter(library: Library): Character | null {
  return library.characters.find((c) => c.created === library.activeId) ?? null;
}

/** Add a character and make it the active one. Returns null when the library is full. */
export function addCharacter(
  library: Library,
  char: Character
): Library | null {
  if (library.characters.length >= LIBRARY_LIMIT) return null;
  // The same sheet imported twice replaces itself rather than doubling.
  const others = library.characters.filter((c) => c.created !== char.created);
  return {
    ...library,
    characters: [...others, char],
    activeId: char.created,
  };
}

/** Replace a character in place, by id. Unknown ids change nothing. */
export function updateCharacter(library: Library, char: Character): Library {
  if (!library.characters.some((c) => c.created === char.created)) {
    return library;
  }
  return {
    ...library,
    characters: library.characters.map((c) =>
      c.created === char.created ? char : c
    ),
  };
}

export function selectCharacter(library: Library, id: string): Library {
  return library.characters.some((c) => c.created === id)
    ? { ...library, activeId: id }
    : library;
}

/** Remove a character. The next one in the list becomes active. */
export function removeCharacter(library: Library, id: string): Library {
  const characters = library.characters.filter((c) => c.created !== id);
  return {
    ...library,
    characters,
    activeId:
      library.activeId === id
        ? (characters[0]?.created ?? null)
        : library.activeId,
  };
}

const MAX_NAME = 40;
const MAX_NOTE = 120;

function validCode(code: DiceCode | undefined): code is DiceCode {
  return (
    !!code &&
    Number.isInteger(code.dice) &&
    Number.isInteger(code.pips) &&
    code.dice >= 1 &&
    code.dice <= 12 &&
    code.pips >= 0 &&
    code.pips <= 2
  );
}

/**
 * Read a character file a player chose, and refuse anything that is not one.
 *
 * `fromExportJSON` checks the version and that the attributes exist. A file is
 * outside text, so this goes further and rebuilds the character from only the
 * fields it knows, with each one checked: a hand-edited file cannot carry an
 * unknown skill, a negative balance, a script in the name, or a ledger that
 * grows without bound. Throws with a plain message the screen shows as-is.
 */
export function importCharacterFile(text: string): Character {
  let parsed: Character;
  try {
    parsed = fromExportJSON(text);
  } catch (e) {
    throw new Error(
      e instanceof SyntaxError
        ? 'That file is not a geoLARP character.'
        : ((e as Error).message ?? 'That file is not a geoLARP character.')
    );
  }

  const attributes = {} as Character['attributes'];
  for (const a of ATTRIBUTES) {
    const code = parsed.attributes[a];
    if (!validCode(code)) throw new Error(`The file has a bad ${a} rating.`);
    attributes[a] = { dice: code.dice, pips: code.pips };
  }

  const skills: Character['skills'] = {};
  for (const [skill, code] of Object.entries(parsed.skills ?? {})) {
    if (!(skill in SKILLS)) continue; // an unknown skill is dropped, not fatal
    if (!validCode(code as DiceCode)) {
      throw new Error(`The file has a bad ${skill} rating.`);
    }
    const c = code as DiceCode;
    skills[skill as SkillName] = { dice: c.dice, pips: c.pips };
  }

  const name = String(parsed.name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  if (!name) throw new Error('The file has no character name.');

  const concept =
    typeof parsed.concept === 'string'
      ? parsed.concept.replace(/\s+/g, ' ').trim().slice(0, 80)
      : '';

  const points = parsed.characterPoints;
  if (!Number.isInteger(points) || points < 0 || points > 999) {
    throw new Error('The file has a bad Character Points balance.');
  }

  const created = typeof parsed.created === 'string' ? parsed.created : '';
  if (Number.isNaN(Date.parse(created))) {
    throw new Error('The file has no creation date.');
  }

  const history: HistoryEntry[] = Array.isArray(parsed.history)
    ? parsed.history
        .filter(
          (h) =>
            h &&
            typeof h.day === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(h.day) &&
            Number.isInteger(h.change)
        )
        .map((h) => ({
          day: h.day,
          skill: String(h.skill ?? '').slice(0, MAX_NAME),
          change: h.change,
          note: String(h.note ?? '').slice(0, MAX_NOTE),
        }))
        .slice(-HISTORY_LIMIT)
    : [];

  const clean: Character = {
    version: 1,
    name,
    attributes,
    skills,
    characterPoints: points,
    created,
  };
  if (
    typeof parsed.earnedOn === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(parsed.earnedOn)
  ) {
    clean.earnedOn = parsed.earnedOn;
    clean.earnedToday = Number.isInteger(parsed.earnedToday)
      ? Math.max(0, parsed.earnedToday as number)
      : 0;
  }
  if (concept) clean.concept = concept;
  if (history.length > 0) clean.history = history;
  return clean;
}

/** File name for an exported sheet: letters, digits and dashes only. */
export function exportFileName(char: Character): string {
  const slug = char.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `geolarp-${slug || 'character'}.json`;
}
