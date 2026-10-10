/**
 * Whether the game offers ways to play without the device's location.
 *
 * ARCHIVED, NOT DELETED. "Pick a zone" (stand somewhere chosen from a list) and
 * "Grid movement" (step from cell to cell by tapping) let someone play without
 * sharing where they are. The owner's rule, 2026-10-10, is "if you don't want to
 * share your location don't play", and his instruction for these modes was
 * "archive them for later if we revisit it, don't delete them yet".
 *
 * So the code stays, its component tests keep running with this switched on, and
 * the e2e tests that need it skip themselves while it is off. Set it to true to
 * bring both modes back. Reasoning: docs/privacy/location-intent.md.
 */
export const LOCATION_FREE_MODES = false;
