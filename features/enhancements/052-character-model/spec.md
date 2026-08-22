# Feature Specification: Character Model & the d7 System

**Feature Branch**: `052-character-model`
**Created**: 2026-08-22
**Status**: Draft — **transcription only**
**Source of record**: [`public/blog/the-world-is-the-board.md`](../../../public/blog/the-world-is-the-board.md) (published 2026-08-22, live at `https://geolarp.com/blog/the-world-is-the-board/`)
**Depends on**: nothing built. The d7 system, character model and encounter engine have no implementation.
**Input**: The mechanics geoLARP has already committed to in public, written down where a test can reach them.

> "The street outside is the board. **Your phone is the character sheet.**" — `:29-30`

---

## Why this exists

**This specification invents nothing.** Every normative statement below is a transcription of something already published, and carries the line it came from.

That is the entire point of the document. Before it, geoLARP's only design authority was a blog post in `public/` — not versioned as a spec, not reachable by `/speckit.*`, never cross-checked by `/analyze`, and binding anyway because it is public and indexed. A reader can hold the project to it; a test cannot.

A search of `features/` (000–051), `docs/prp-docs/` and `specs/` finds no character model, d7 system, or encounter-engine specification. The five attribute names appear in exactly two files in this repository: the post itself and the generated `src/lib/blog/blog-data.json`.

**Consequence for whoever implements this:** where the post is silent, this document is silent too. Gaps are marked ⚠️ **UNSPECIFIED** rather than filled in. Filling one is a design decision that belongs in a follow-up, not an inference from this file.

---

## 1. The die

|                  | value                                                   | source       |
| ---------------- | ------------------------------------------------------- | ------------ |
| Die              | `1d7`                                                   | `:37`        |
| Each face        | 14.3%                                                   | `:42`        |
| Average roll     | 4.0                                                     | `:43`        |
| Critical success | natural 7 — 14.3%                                       | `:44`, `:46` |
| Complication     | natural 1, occurring "about as often as a 7 saves them" | `:49`        |
| Advantage        | `2d7 keep highest`                                      | `:52`        |
| Disadvantage     | `2d7 keep lowest`                                       | `:52`        |

The post's wording is "a **natural 7**" (`:46`). It does not say what a natural 7 is contrasted against, and this document does not supply one.

`1d7` is digital-only of necessity — a solid cannot be fairly divided into seven equal faces (`:61-63`). The site's mark is the seven-sided die, described as "the one design decision everything else is built on" (`:57-58`).

⚠️ **UNSPECIFIED:** what a roll is made _against_. No target numbers, difficulty ladder, or success/failure bands are published. "Challenge rating" appears once (`:70`) with no definition.

## 2. Attributes

Five, named (`:52-53`):

**Strength · Agility · Intellect · Spirit · Luck**

They sit on the **same 1–7 scale as the die**, "so a character sheet reads in the same units as the roll." The post calls that symmetry "most of why the system is worth the trouble" (`:53-55`).

⚠️ **UNSPECIFIED:** how attribute values are produced (rolled, point-buy, template), whether modifiers exist at all, and whether anything other than the five attributes is on a character. No modifier range is published anywhere — a sheet that renders a modifier column is making a decision this document cannot supply.

## 3. Character lifecycle

| commitment                                                     | source     |
| -------------------------------------------------------------- | ---------- |
| Generated in "well under a minute — the target is ten seconds" | `:99`      |
| Lives in the browser's storage                                 | `:100`     |
| Exportable as a file **or a QR code**                          | `:100`     |
| Can be carried to another device via that export               | `:100-101` |
| "Nothing about you goes to a server"                           | `:101`     |
| The player is responsible for the export                       | `:102`     |
| Clearing browser data clears the character                     | `:102-103` |
| **"the game will warn you rather than quietly lose it"**       | `:103`     |

Note the ten seconds is stated as a **target**, not a guarantee; "well under a minute" is the commitment.

The warning promise (`:103`) is a hard requirement and is currently **violated by shipped code** — see §7.

⚠️ **UNSPECIFIED:** the storage key, the export file format, the QR encoding, and what the warning looks like or when it fires.

## 4. The grid and encounters

| commitment                                                                                                               | source          |
| ------------------------------------------------------------------------------------------------------------------------ | --------------- |
| The world is divided into **100-metre cells**                                                                            | `:68`           |
| Each cell's coordinates are **hashed into a seed**                                                                       | `:68`           |
| **The seed is place _and_ time**: "that patch of ground **and today's date** hash to it"                                 | `:31-32`        |
| The seed generates what is there                                                                                         | `:68-69`        |
| **Five** encounter kinds: monster, trader, cache, shrine, trap                                                           | `:69-70`        |
| Scaled by "a challenge rating tuned to the d7 curve"                                                                     | `:70`           |
| Deterministic and identical for every player — "derived from the place, not handed out"                                  | `:74-77`        |
| No server assigns an encounter; no matchmaking, no world state, no database of what is where                             | `:74`, `:79-80` |
| The device **can** generate the **3×3 grid of cells** around the player, fully offline, from previously cached map tiles | `:80-81`        |

**The seed has a temporal axis, and it is easy to miss.** The encounters section (`:68`) mentions only coordinates; the commitment that today's date is part of the hash is made earlier, in the opening (`:31-32`). An implementation seeded on place alone would be wrong against the published design — and would also break the "walk past an hour later" framing at `:75-76`, which describes sameness _within_ a day.

The determinism is not an optimisation. The post ties it directly to the product claim: it "is what makes it a shared world rather than a private one" (`:76-77`).

⚠️ **UNSPECIFIED:** the granularity and boundary of "today's date" — timezone, UTC day, or local midnight. The post commits to the axis, not its resolution.

⚠️ **UNSPECIFIED:** the hash function, the seed derivation, the cell-boundary convention (which coordinate rounds to which cell), and how a challenge rating is computed.

**Explicitly provisional:** the five encounter kinds are described by the post itself as "placeholders wearing familiar clothes" (`:137`). They are transcribed here because they are published, not because they are settled.

## 5. Location and privacy

| commitment                                                                             | source   |
| -------------------------------------------------------------------------------------- | -------- |
| Location is rounded to **100 metres before anything is done with it**                  | `:87`    |
| The rounding **is the grid** — not a privacy feature added afterwards                  | `:87-89` |
| The game "never knows which building you are in"                                       | `:90`    |
| No tracking to switch off and no location history to leak, "because none is collected" | `:92-93` |
| Denying the permission entirely still plays                                            | `:93`    |

Three published fallbacks when permission is denied (`:94-95`):

1. a coarse network location
2. a zone the player picks by hand
3. grid movement with no GPS at all

**This section is the one with the widest gap between promise and code.** The "none is collected" half holds — there are no geo columns anywhere in `supabase/migrations/20251006_complete_monolithic_setup.sql`. The rounding half does not — see §7.

## 6. Play loop

| commitment                                                          | source     |
| ------------------------------------------------------------------- | ---------- |
| Quests are built around real distance                               | `:105`     |
| "walk a quarter mile and see what is at the other end"              | `:105-106` |
| Design target: **about half a mile of actual walking in a session** | `:106-107` |
| "This is a game that only works if you move"                        | `:107`     |

The half-mile figure is published as a **guess** — see §8, question 3.

## 7. Where shipped code already contradicts this

Both are tracked separately; recorded here because a spec that omits them would be describing a product that does not exist.

**The 100-metre rounding has no implementation.** `src/hooks/useGeolocation.ts:142`, `src/app/map/page.tsx:48` and `src/components/map/MapContainer/MapContainer.tsx:130` all request `enableHighAccuracy: true`, and `src/app/map/page.tsx:179` renders the device fix at `toFixed(4)` — roughly 11 metres, not 100. A repo-wide search finds no coordinate rounding, coarsening or snapping of any kind.

**`/privacy-controls` will destroy a character stored in `localStorage`.** `src/utils/privacy.ts:193-200` enumerates every `localStorage` key and removes anything not on a one-item allowlist (`PrivacyControls.tsx:99` — `['cookieConsent']`). No character exists yet, so nothing is lost today; the contradiction arrives with the first one.

It is worse than "no warning": `/privacy-controls/page.tsx:23` renders `<PrivacyControls />` with no props and `PrivacyControls.tsx:36` defaults `showConfirmation = false`, so **Delete fires on the first click** and the confirmation dialog in that component is dead code on this route. An "Export My Data" control sits on the same panel and would capture the character, but nothing offers it at delete time. Directly against `:103`.

Note the post says "your browser's storage" (`:100`), not `localStorage`. A character in IndexedDB would survive `clearUserData` untouched — which makes the storage choice a privacy-relevant decision, not just a technical one. Tracked as #37.

**The post claims these specifications already exist, and they did not.** `:124` reads "Designed, specified, not yet a game you can play: the d7 system, the character model, the encounter engine, the offline map layer. **The specifications are written.**" No such specification was in the repository on the day that published — which is why this document exists. It is the largest of the three contradictions, because it is a public claim about the repo that the repo refutes.

**A fourth committed component is not covered here.** `:124` names "the offline map layer" alongside the d7 system, character model and encounter engine. This spec transcribes the first three. The offline map layer needs its own.

## 8. Open by the author's own statement

The post lists four questions as unanswered (`:132-146`). They are **not** gaps in this transcription; they are published as open, and implementing past them would be inventing.

1. **What is the fiction?** "The mechanics are specified; the _world_ is not." Fantasy over the real street, near-future, folk-horror, or something with no combat at all. The five encounter types are placeholders.
2. **What happens when two players are in the same cell?** "Right now the design is single-player-shaped with a shared world." Co-op, competition, or merely knowing someone has been here — each pulls the design somewhere different.
3. **How much walking is too much?** "Half a mile a session is a guess. It is the difference between a game you play on a commute and one you make a trip for, **and I do not know which this should be**."
4. **Does the seven hold up in play?** "Whether it feels generous or chaotic is not something arithmetic can tell me."

## 9. Acceptance criteria for this document

This spec is correct when:

- [ ] Every normative statement traces to a line in the source post
- [ ] No mechanic appears here that does not appear there
- [ ] Every gap an implementer would hit is marked ⚠️ **UNSPECIFIED** rather than resolved
- [ ] The four open questions are preserved as open, not answered
- [ ] §7 matches the state of the code at the time of writing

It is **not** a design document. It does not decide the fiction, the target numbers, the hash, the export format, or the multiplayer model. Those need their own specs, and each of them is now blocked on a decision rather than on archaeology.

## 10. How this was checked

The first draft failed its own test, and the failures are recorded here because they are the ones the next transcription will make too.

An adversarial review against the source found:

- **A dropped commitment.** §4 transcribed only "coordinates are hashed into a seed" (`:68`) and lost "and **today's date**" from `:31-32` — then framed the result as "deterministic and identical for every player". That silently resolved the most consequential open question in the encounter engine, in the one document written to stop exactly that. The commitment sat in the opening paragraph rather than the section it belongs to, which is how it went missing.
- **Three invented claims.** A normative resolution rule with a probability the post never computes; a natural-versus-total contrast attributed to a post that never draws it; and the word "fixed" over an attribute list the post merely names.
- **One modal strengthening** — "can generate" (`:81`) rendered as "generates".
- **Four mis-citations**, all off-by-a-line or incomplete ranges.

All are corrected above. The lesson worth keeping: **a transcription fails by omission far more dangerously than by error**, because an omission leaves no artefact to check — and it is likeliest where a commitment appears somewhere other than the section that owns it.
