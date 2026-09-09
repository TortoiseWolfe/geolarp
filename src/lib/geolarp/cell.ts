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
/** Flat-to-flat width of a cell. Unchanged from the square grid, on purpose. */
export const CELL_METRES = 100;

/**
 * Row pitch of a pointy-top hex lattice: `CELL_METRES * √3 / 2`.
 *
 * HARD-CODED, NOT `Math.sqrt(3)`. This sits upstream of `LAT_STEP` and therefore
 * of every `cellOf` on Earth, and `stableCos` below exists precisely because an
 * implementation-approximated call in that position can move a `Math.floor` and
 * put two phones on the same pavement in different cells. `Math.sqrt` is correctly
 * rounded on every engine anyone ships, but the standard in this file is measured
 * rather than assumed, and a decimal literal is exactly specified by ECMA-262.
 *
 * 86.60254037844386 is `100 * Math.sqrt(3) / 2` to full double precision.
 */
export const ROW_METRES = 86.60254037844386;

/**
 * A cell of the world, in pointy-top hex coordinates.
 *
 * `q` is the column WITHIN ITS ROW and `r` the row; odd rows are offset half a
 * column east. Renamed from `{x, y}` deliberately rather than reinterpreted —
 * a same-shaped record with new semantics gives vague type errors at each call
 * site, where a rename gives one clear error per consumer and the compiler walks
 * them all.
 */
export interface Cell {
  /** Quantised longitude index within the row, corrected for latitude. */
  q: number;
  /** Quantised latitude index. Rows are `ROW_METRES` apart, not `CELL_METRES`. */
  r: number;
}

const LAT_STEP = ROW_METRES / M_PER_DEG_LAT;

function rowOf(lat: number): number {
  return Math.floor(lat / LAT_STEP);
}

function rowCentreLat(r: number): number {
  return (r + 0.5) * LAT_STEP;
}

/**
 * The half-column stagger that makes this a hex lattice rather than a brick wall.
 *
 * Odd rows sit half a column east. Six neighbours then fall at equal distance —
 * that is the whole reason for the conversion, and it is one line.
 *
 * `((r % 2) + 2) % 2` rather than `r % 2`, because JavaScript's remainder keeps
 * the sign of the dividend: `-3 % 2` is `-1`, so a bare test would stagger the
 * southern hemisphere the wrong way and every neighbour below the equator would
 * be half a cell out.
 */
function rowOffset(r: number): number {
  return ((r % 2) + 2) % 2 === 1 ? 0.5 : 0;
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
/** How finely the cosine is quantised. The reasoning is on `stableCos` below. */
const COS_QUANTUM = 2 ** 44;

/**
 * `Math.cos` rounded to a fixed grid, so every JS engine returns the same number.
 *
 * THIS IS A DETERMINISM FIX, NOT AN OPTIMISATION, AND IT IS THE ONLY ENGINE-DEPENDENT
 * CALL IN THE WHOLE RULES LAYER. Everything else — `Math.imul`, XOR, shifts, `Math.floor`,
 * `/` — is exactly specified by ECMA-262 and is bit-identical everywhere. `Math.cos` is
 * explicitly *implementation-approximated*, and Hermes routes it to the platform libm:
 * Apple's on iOS, bionic's on Android, glibc under Node. They may disagree in the last
 * bit or two.
 *
 * That matters here because this value is a DIVISOR, upstream of every seed on Earth.
 * A one-ULP difference moves the divisor, and at a cell boundary it moves the
 * `Math.floor` in `cellOf`. Two phones standing on the same line would land in
 * different cells and meet different encounters — falsifying the published claim that
 * the encounter is "the same for everybody", in exactly the case nobody can reproduce
 * on purpose. An Android emulator cannot clear it either, because Android libm is not
 * iOS libm.
 *
 * 2**44 was measured, not guessed. Against the unquantised function over a 200,000-point
 * global sweep:
 *
 *   quantum   ULPs absorbed   cells moved   worst boundary shift
 *   2**20     8.6e9           2.52%         36 m        <- rewrites the world
 *   2**30     8.4e6           0.0125%       3.6 cm
 *   2**44     5.1e2           0             2 microns   <- chosen
 *   2**52     2.0            0             1.2e-8 m    <- too tight to absorb anything
 *
 * The window exists because the error we must absorb (a ULP, ~2e-16) and the error we
 * must not introduce (a shift big enough to cross a boundary) are eight orders of
 * magnitude apart. 2**44 sits in the middle: ~500 ULPs of headroom against any plausible
 * libm, and a boundary that moves by two microns — so no existing cell assignment changes.
 *
 * Note the ARGUMENT to cos is already engine-stable: `Math.PI` is an exact double and
 * the multiply and divide are exactly specified. Only the cosine itself varies.
 */
function stableCos(radians: number): number {
  return Math.round(Math.cos(radians) * COS_QUANTUM) / COS_QUANTUM;
}

function lonStepForRow(r: number): number {
  const cosLat = stableCos((rowCentreLat(r) * Math.PI) / 180);
  // Guard the poles, where a longitude step goes to zero.
  return CELL_METRES / (M_PER_DEG_LAT * Math.max(cosLat, 1e-6));
}

/**
 * Quantise a fix to its 100m cell. This is the only function that ever sees a
 * raw GPS reading; everything downstream works from the cell.
 */
/**
 * Which column of row `y` holds this longitude.
 *
 * Split out because `neighbour` needs to ask it about a row the caller is not
 * standing in, which is the whole of the #86 fix.
 */
/**
 * Which column of row `r` holds this longitude, accounting for the stagger.
 *
 * Split out because `neighbour` needs to ask it about a row the caller is not
 * standing in — the whole of the #86 fix, carried forward to the hex lattice.
 */
function columnAt(lon: number, r: number): number {
  return Math.floor(lon / lonStepForRow(r) - rowOffset(r));
}

/**
 * The fractional column position of a longitude in row `r`.
 *
 * `columnAt` is this floored. `neighbour` needs the fraction as well, to know
 * which SIDE of the containing column the longitude sits on — that is what picks
 * the second of the two cells in an adjacent row. Exact arithmetic only: a
 * division and a subtraction, no trigonometry, because this decides a cell index
 * and therefore a seed.
 */
function columnPosition(lon: number, r: number): number {
  return lon / lonStepForRow(r) - rowOffset(r);
}

export function cellOf(lat: number, lon: number): Cell {
  const r = rowOf(lat);
  return { r, q: columnAt(lon, r) };
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
    lat: rowCentreLat(cell.r),
    lon: (cell.q + rowOffset(cell.r) + 0.5) * lonStepForRow(cell.r),
  };
}

/** Stable string form, for seeding and for display. */
export function cellKey(cell: Cell): string {
  return `${cell.q}:${cell.r}`;
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

/**
 * The cell `dx` columns east and `dy` rows north of this one.
 *
 * NOT `{x: x + dx, y: y + dy}`, and that mistake is #86. Rows are aligned by
 * latitude, but each row indexes its columns from the prime meridian using its
 * OWN longitude quantum, so column `x` in row `y + 1` is not above column `x`
 * in row `y`. The ground offset between them is grid convergence, and it has a
 * closed form — measured against this module to two decimals:
 *
 *     slide_per_row = CELL_METRES * λ * sin(φ)          (λ in RADIANS)
 *
 *     London        -0.17 m        Chattanooga    -85.50 m
 *     Singapore      4.28 m        Sydney        -147.07 m
 *
 * It reaches 100π ≈ 314 m near the antimeridian, and wherever it exceeds half
 * a cell the integer form names a cell the player is not next to — 56% of
 * inhabited latitudes, worst case 293.6 m, three cells out.
 *
 * The honest question is "which cell of the TARGET row holds my longitude",
 * so ask that, then step `dx` columns within that row. Two properties make
 * this the right operator rather than a workaround:
 *
 *   - Within a row it is exactly `x + dx`. `lonStepForRow(y)` is the same
 *     divisor on both sides, so `columnAt` returns `x` unchanged. Verified
 *     over 115,128 same-row steps: bit-identical, no float drift introduced.
 *   - It adds NO new `Math.cos`. Re-indexing a longitude we already hold stays
 *     inside `lonStepForRow`; converting through metres would have put a fresh
 *     implementation-approximated call upstream of a cell assignment, which is
 *     exactly what `stableCos` exists to prevent.
 *
 * WHAT IT DOES NOT FIX. North and south are not perfectly reciprocal: a
 * parallel further from the equator is shorter and holds fewer 100 m cells, so
 * two side-by-side cells occasionally share one northern neighbour and
 * `south(north(c))` lands one cell over. Measured at 0 of 7,160 sampled
 * columns at the equator, at 35° and at 60°, and 2 of 7,160 at 85°. That is
 * geometry, not arithmetic — no scheme with integer columns on latitude rings
 * avoids it — and it never produces a duplicate inside one `grid3x3`.
 *
 * The antimeridian is also still a seam, and out of scope here: columns per
 * full circle is not an integer at a general latitude, so `x` jumps by ~328k
 * between +179.9999° and -179.9999°. Tracked with the lattice work in #87.
 */
export const HEX_DIRECTIONS = [
  'east',
  'north-east',
  'north-west',
  'west',
  'south-west',
  'south-east',
] as const;

export type HexDirection = (typeof HEX_DIRECTIONS)[number];

/**
 * The cell one step away, in one of SIX directions.
 *
 * THERE IS NO DUE NORTH, and that is forced rather than chosen. A pointy-top hex
 * has flat sides east and west, so its neighbours are E, NE, NW, W, SW, SE. The
 * alternative — flat-top — puts a centre's LATITUDE on its column, which makes
 * `lonStepForRow` depend on longitude and destroys the exact inverse this module
 * is built on. Six steps of one distance, bought with the compass.
 *
 * WITHIN A ROW it is exactly `q ± 1`: same divisor on both sides, so the stagger
 * cancels and no float drift is introduced.
 *
 * ACROSS A ROW it asks the #86 question — "which cell of the TARGET row holds my
 * longitude" — and then picks the nearer of that column and its neighbour. Adding
 * a raw delta instead is the mistake #86 was filed for: each row indexes from the
 * prime meridian with its own quantum, so `q` in row `r + 1` is not above `q` in
 * row `r`. Measured on the square grid this reached 293.6 m and three cells.
 *
 * `frac < 0.5` is the whole of the side test. The longitude sits somewhere inside
 * column `base` of the target row; if it is in that column's western half the
 * other neighbour is to the west, otherwise to the east. Exact arithmetic — a
 * subtraction and a comparison — because this picks a cell index and therefore an
 * encounter seed.
 */
export function neighbour(cell: Cell, direction: HexDirection): Cell {
  if (direction === 'east') return { r: cell.r, q: cell.q + 1 };
  if (direction === 'west') return { r: cell.r, q: cell.q - 1 };

  const north = direction === 'north-east' || direction === 'north-west';
  const east = direction === 'north-east' || direction === 'south-east';
  const r = cell.r + (north ? 1 : -1);

  const pos = columnPosition(cellCentre(cell).lon, r);
  const base = Math.floor(pos);
  const frac = pos - base;
  // The two cells of row `r` that touch this one, west-first.
  const west = frac < 0.5 ? base - 1 : base;
  return { r, q: east ? west + 1 : west };
}

/**
 * A cell and its six neighbours, laid out 2-3-2 for a renderer.
 *
 * Index 0-1 are the northern pair, 2-4 the middle row WITH THE CENTRE AT 3, and
 * 5-6 the southern pair. Rows run north-first so a renderer can lay the array
 * straight down the screen and get a map-shaped map; latitude indices grow
 * northward, so counting down is what keeps north up.
 *
 * Replaces `grid3x3`. The nine-cell square version had four cells at 100 m and
 * four at 141 m; every cell here is one step, which is the point of the lattice.
 */
export function flower(centre: Cell): Cell[] {
  return [
    neighbour(centre, 'north-west'),
    neighbour(centre, 'north-east'),
    neighbour(centre, 'west'),
    centre,
    neighbour(centre, 'east'),
    neighbour(centre, 'south-west'),
    neighbour(centre, 'south-east'),
  ];
}

export interface CellOffset {
  /** Metres east of `from`; negative is west. */
  east: number;
  /** Metres north of `from`; negative is south. */
  north: number;
  /** Straight-line distance, rounded to the metre. */
  metres: number;
  /** A compass word, or null when the two cells are the same. */
  bearing: string | null;
}

const BEARINGS = [
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
  'south',
  'south-east',
] as const;

/**
 * How far one cell is from another, in metres.
 *
 * LATTICE ARITHMETIC, and deliberately not a Haversine. `lonStepForRow` already
 * scales the longitude step by the row's cosine, so a cell is CELL_METRES across
 * the flats by construction; a great-circle formula would only add floating-point
 * noise to a number the grid already knows.
 *
 * NO LONGER A MULTIPLE OF 100. On the hex lattice east comes in halves (the
 * stagger) and north in units of ROW_METRES = 86.60254, so a single step measures
 * (±100, 0) or (±50, ±86.6). That is the conversion working: every one of those
 * is 100 m long, which is what the square grid could not say of its diagonals.
 *
 * It is also the honest unit. This measures grid movement, which is what the
 * player has actually been doing; a metre figure derived from cell centres
 * would imply a precision the grid does not carry.
 *
 * THE ABOVE WAS FALSE ACROSS ROWS UNTIL #86, and this comment was the bug's
 * own explanation: `to.x - from.x` subtracts two column indices measured
 * against DIFFERENT longitude quanta, so it is not a distance. It reported a
 * one-cell "north-east" step at Sydney as `east: 100` when the truth was 47 m
 * WEST, and after a 30 km walk due north at Chattanooga it claimed 25.7 km of
 * easting that never happened. 32.8% of one-cell steps carried the wrong
 * compass word; 54.6% were off by more than 10 m.
 *
 * Projecting `from` into `to`'s row first is what makes the claim true. It
 * stays exact integer arithmetic — no cosine, no square root, still a multiple
 * of 100 — verified over 126,294 cross-row offsets. Within a row it is
 * unchanged, because `columnAt(cellCentre(c).lon, c.y)` is `c.x` by
 * construction.
 */
export function offsetMetres(from: Cell, to: Cell): CellOffset {
  // Column UNITS, not column indices. The stagger puts odd rows half a column
  // east, so a north-east step is +50 m east and +86.6 m north — a half-cell
  // figure the old integer subtraction could not express. `columnPosition` is
  // the same quantity `columnAt` floors, so this stays exact where the old form
  // was exact and gains the halves it needs.
  const fromLon = cellCentre(from).lon;
  const east = (to.q + 0.5 - columnPosition(fromLon, to.r)) * CELL_METRES;
  const north = (to.r - from.r) * ROW_METRES;
  if (east === 0 && north === 0) {
    return { east, north, metres: 0, bearing: null };
  }
  const octant = Math.round(Math.atan2(north, east) / (Math.PI / 4));
  return {
    east,
    north,
    metres: Math.round(Math.hypot(east, north)),
    bearing: BEARINGS[((octant % 8) + 8) % 8],
  };
}
