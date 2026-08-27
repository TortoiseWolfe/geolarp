/**
 * The 100-metre grid.
 *
 * THIS IS THE PRIVACY DESIGN, NOT A HELPER. The published promise is that
 * "Location is rounded to 100 metres BEFORE anything is done with it" and that
 * "the game never knows which building you are in"
 * (`the-world-is-the-board.md:87-90`). So the raw fix must reach `cellOf` and
 * nothing else — no logging it, no formatting it, no putting it in a URL.
 *
 * The same coarseness is what makes encounters stable, which is why the post
 * calls the rounding "not a privacy feature bolted on afterwards. It is the grid."
 */

/** Metres per degree of latitude. Constant enough at this resolution. */
const M_PER_DEG_LAT = 111_320;
export const CELL_METRES = 100;

export interface Cell {
  /** Quantised latitude index. */
  y: number;
  /** Quantised longitude index, corrected for latitude. */
  x: number;
}

const LAT_STEP = CELL_METRES / M_PER_DEG_LAT;

function rowOf(lat: number): number {
  return Math.floor(lat / LAT_STEP);
}

function rowCentreLat(y: number): number {
  return (y + 0.5) * LAT_STEP;
}

/**
 * The longitude step for a row, keyed on the ROW rather than the raw fix.
 *
 * Longitude degrees shrink with latitude, so the step must be scaled by
 * cos(lat) or cells narrow toward the poles. Deriving that cosine from the
 * row's centre — not from the caller's latitude — is what makes `cellCentre`
 * an exact inverse of `cellOf`. Using the raw latitude instead looks
 * equivalent and is not: the two cosines differ in the twelfth decimal place,
 * multiplied by an x index in the tens of thousands, which put the "centre" of
 * a Chattanooga cell 101m from the fix that produced it.
 */
function lonStepForRow(y: number): number {
  const cosLat = Math.cos((rowCentreLat(y) * Math.PI) / 180);
  // Guard the poles, where a longitude step goes to zero.
  return CELL_METRES / (M_PER_DEG_LAT * Math.max(cosLat, 1e-6));
}

/**
 * Quantise a fix to its 100m cell. This is the only function that ever sees a
 * raw GPS reading; everything downstream works from the cell.
 */
export function cellOf(lat: number, lon: number): Cell {
  const y = rowOf(lat);
  return { y, x: Math.floor(lon / lonStepForRow(y)) };
}

/**
 * The centre of a cell, as a lat/lon.
 *
 * This is the ONLY location the app should ever display, log or hand to a map.
 * It is derived from the cell index, so it carries no more precision than the
 * grid does — the real fix cannot be recovered from it, and a player is never
 * shown a pin on their own roof. The worst case is half a diagonal, ~71m.
 */
export function cellCentre(cell: Cell): { lat: number; lon: number } {
  return {
    lat: rowCentreLat(cell.y),
    lon: (cell.x + 0.5) * lonStepForRow(cell.y),
  };
}

/** Stable string form, for seeding and for display. */
export function cellKey(cell: Cell): string {
  return `${cell.x}:${cell.y}`;
}

/**
 * The seed for a cell on a given day.
 *
 * PLACE **AND DATE**. The published line is that something is there "because
 * that patch of ground and today's date hash to it" (`:31-32`) — the encounters
 * section at `:68` mentions only coordinates, which is how the temporal half
 * gets missed. It reseeds daily; two players in the same cell on the same day
 * meet the same thing, which is what makes it "a shared world rather than a
 * private one" (`:76-77`).
 *
 * The day is taken in UTC so two players either side of midnight local time
 * still agree. That is a choice — `resolution.md` marks the boundary
 * convention UNSPECIFIED — and it is the one that keeps the shared-world claim
 * true across a timezone edge.
 */
export function seedOf(cell: Cell, date: Date = new Date()): string {
  return `${cellKey(cell)}@${utcDay(date)}`;
}

/**
 * The UTC day, `YYYY-MM-DD`. The game's only clock.
 *
 * Extracted so the world and the player cannot disagree about when the day
 * turned. `seedOf` uses it to decide what is in a cell; the Character Point
 * ledger uses it to decide when the daily cap resets. Two inlined
 * `toISOString().slice(0, 10)` calls would be identical until someone
 * "helpfully" made one of them local time, and then a player near midnight
 * would earn against a day the world had not reached.
 */
export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
