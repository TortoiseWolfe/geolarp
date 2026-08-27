/**
 * A name for a cell.
 *
 * "Meet me at the Low Gate" is a sentence. `-77750:39012` never could be, and
 * that is the whole point of this file — the key is precise, shareable and
 * completely unsayable, so it stays where it is and a name sits ABOVE it.
 * `EncounterCard` still prints the key, because its audit-trail job is real:
 * two players standing together check the key, and talk about the name.
 *
 * THE NAME IS SEEDED FROM THE CELL KEY, NEVER FROM `seedOf`. This is the one
 * rule in here that a later tidy-up will want to break, because the two seeds
 * look interchangeable and one import would remove a line. It would silently
 * rename every place on the planet at midnight UTC. A place whose name changes
 * daily is not a place — the ENCOUNTER reseeds, the ground does not — so
 * `place.test.ts` asserts date-independence directly.
 *
 * The seed is also domain-prefixed. Without `name:`, the name and the day's
 * encounter would be drawn from the same stream, and a player could learn to
 * read the difficulty off the name.
 */
import { Cell, cellKey } from './cell';
import { Rng } from './rng';

/**
 * Words chosen to read as landmarks in a fiction, and chosen NOT to read as
 * anything a real place is called. No saints, no compass points, no street
 * types, nothing that could be mistaken for a geocoded address — the app must
 * never appear to know where you actually are, and a plausible-sounding real
 * address is exactly what that mistake would look like.
 */
const QUALIFIERS = [
  'Low',
  'High',
  'Old',
  'Broken',
  'Quiet',
  'Hollow',
  'Grey',
  'Amber',
  'Cold',
  'Long',
  'Narrow',
  'Crooked',
  'Silent',
  'Rusted',
  'Pale',
  'Deep',
  'Bitter',
  'Sunken',
  'Hidden',
  'Last',
  'First',
  'Lesser',
  'Greater',
  'Iron',
  'Copper',
  'Salt',
  'Ash',
  'Ember',
  'Frost',
  'Thistle',
  'Bramble',
  'Willow',
  'Alder',
  'Rowan',
  'Hazel',
  'Ivy',
  'Moss',
  'Fern',
  'Reed',
  'Slate',
  'Chalk',
  'Flint',
  'Clay',
  'Sable',
  'Umber',
  'Ochre',
  'Verdant',
  'Withered',
  'Weathered',
  'Forgotten',
  'Nameless',
  'Wandering',
  'Patient',
  'Restless',
  'Sleeping',
  'Waking',
  'Hungry',
  'Kindly',
  'Stubborn',
  'Careful',
  'Idle',
  'Errant',
  'Crimson',
  'Hollowed',
  'Splintered',
  'Tilted',
  'Leaning',
  'Sagging',
  'Sunlit',
  'Moonlit',
  'Shaded',
  'Windward',
  'Leeward',
  'Upper',
  'Nether',
  'Outer',
  'Inner',
  'Middle',
  'Far',
  'Near',
  'Wide',
  'Thin',
  'Blunt',
  'Sharp',
  'Bright',
  'Dim',
  'Still',
  'Swift',
  'Sullen',
  'Merry',
] as const;

const FEATURES = [
  'Gate',
  'Mill',
  'Well',
  'Ford',
  'Bridge',
  'Arch',
  'Steps',
  'Yard',
  'Market',
  'Kiln',
  'Forge',
  'Granary',
  'Cistern',
  'Aqueduct',
  'Culvert',
  'Causeway',
  'Embankment',
  'Terrace',
  'Cloister',
  'Chantry',
  'Belfry',
  'Watchtower',
  'Barbican',
  'Rampart',
  'Palisade',
  'Ditch',
  'Dyke',
  'Weir',
  'Sluice',
  'Lock',
  'Wharf',
  'Quay',
  'Jetty',
  'Slipway',
  'Boathouse',
  'Toll',
  'Waystone',
  'Milestone',
  'Cairn',
  'Barrow',
  'Standing',
  'Shrine',
  'Reliquary',
  'Ossuary',
  'Crypt',
  'Undercroft',
  'Cellar',
  'Vault',
  'Larder',
  'Buttery',
  'Brewhouse',
  'Bakehouse',
  'Smokehouse',
  'Tannery',
  'Dyeworks',
  'Fullery',
  'Ropewalk',
  'Cooperage',
  'Wheelwright',
  'Almshouse',
  'Infirmary',
  'Lazaret',
  'Hostel',
  'Common',
  'Green',
  'Orchard',
  'Coppice',
  'Hedgerow',
  'Warren',
  'Byre',
  'Fold',
  'Pound',
  'Paddock',
  'Stable',
  'Mews',
  'Kennels',
  'Dovecote',
  'Apiary',
  'Fishpond',
  'Millpond',
  'Spring',
  'Hollow',
  'Dell',
  'Combe',
  'Scarp',
  'Bluff',
  'Spur',
  'Saddle',
  'Notch',
  'Verge',
] as const;

/**
 * The number of distinct names this can produce. Exported so the test that
 * cares about collision pressure derives it rather than restating it — a
 * hardcoded figure would go quietly wrong the first time a word is added.
 */
export const PLACE_NAME_SPACE = QUALIFIERS.length * FEATURES.length;

/**
 * The name of a cell. Stable for as long as the cell exists.
 *
 * `date` is deliberately not a parameter. There is nowhere to pass one, which
 * is the cheapest possible defence against the mistake this file exists to
 * prevent.
 */
export function placeName(cell: Cell): string {
  const rng = new Rng(`name:${cellKey(cell)}`);
  return `${rng.pick(QUALIFIERS)} ${rng.pick(FEATURES)}`;
}
