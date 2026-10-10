# Location: what the game knows, what leaves the device, and what we say

Written 2026-10-10. This is the proofread of every location claim against what the
game is meant to become, and the record of the decisions behind
`/app-privacy/` (`src/app/app-privacy/page.tsx`).

## The intent, as the owner set it

- **A game master sees exactly where every adult player in their game is, during
  the game.** That is what game dynamics need: encounters, who is near whom, a game
  someone runs. In the owner's words: _"adults are more accurate than a 100 meter
  square, the game master is trusted by their players and needs complete accuracy,
  you should know your game master."_
- **Only during the game.** Positions are not kept as history.
- **Adults and minors play different versions.** Under-18s play solo only.
- **The first published policy describes this intended game**, marked clearly as
  not yet in the app, rather than describing only today's build.

The rule underneath all of it is the owner's, from 2026-10-04: _"we still have to
know where the player or at least their device is, but we can't let that leak."_
Precise is fine on the device. What leaves the device stays as coarse as the game
allows, or doesn't leave at all.

**The 2026-10-10 decision refines it, and does not drop it.** A leak is a position
reaching someone the player did not choose. An adult who joins a game run by a game
master they know has chosen that person, and the game master needs the exact
position to run it. So for that one recipient, live only, the exact position goes.
Everyone else (other players, anyone outside the game, history) still gets nothing,
and under-18s still send nothing at all.

## The design the policy states

|                        | Solo play                                                     | Game-master games (not built yet)                               |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Who                    | Anyone 13 and over                                            | Adults (18 and over) only, at launch                            |
| What the device does   | Takes a fix when you ask, rounds it to the 100 m cell at once | Takes precise fixes while the game runs                         |
| What leaves the device | Nothing                                                       | Your exact position, to the server, for that game's game master |
| Who sees it            | Nobody                                                        | The game master of a game you joined, and no one else           |
| How long               | Not kept anywhere                                             | Only while the game runs; forgotten when you leave or it ends   |
| Exact position         | Never stored, shown or sent                                   | Shown to your game master, live; never stored as history        |
| Account                | None                                                          | Needed, so the game master knows who is who                     |

Under-18s never send a position. That is the "different version": the whole of
today's game, without the one feature that puts a position on a server.

**Know your game master** is the safety model, and the policy says it in those
words: the platform does not vet game masters; the players' own trust does. That is
also why game-master games are adults only.

**Apple's label is "Precise Location"**, and now it is precise in every sense.

**What game-master games will need from the code** (none of it exists yet):

- Precise fixes, not `fix.ts`'s Balanced reading rounded at once. The rounding stays
  for solo play and for under-18s.
- Repeated fixes while the game runs, which is geolarp#90's watch, and its dwell
  rule against cell flicker.
- Whether the game keeps tracking the player while the phone is locked. Background
  location is forbidden today by `audit:plist` and needs a justification that Apple
  reviews.

Not yet decided, and the policy does not claim them: how age is confirmed (the
website has no date-of-birth field today), and what a game master can do beyond
seeing positions.

## Why each location rule exists

Sorted by where the thing it protects lives.

**On the device**

- _One fix per press, never a watch_ (`geoLARP-Expo/src/game/fix.ts`). Gameplay,
  not privacy: one fix per press stops a player flickering between cells at a
  boundary. geolarp#90 is the issue for a watch, and it needs the dwell rule first.
- _Coordinates die inside the function that rounds them_ (`fix.ts`,
  `src/lib/geolarp/coarseFix.ts`). Privacy: nothing downstream can store, log or
  display what it never receives.
- _No map and no dot in the app_ (`geoLARP-Expo/src/app/field.tsx`). Privacy as
  written, but the 2026-10-04 rule allows a precise dot on the device. Revisit as a
  design choice, not a privacy rule.
- _Foreground only, no background location_ (`app.json`,
  `tools/audit-info-plist.mjs`). Both: the game is played with the app open, and
  background location needs a justification Apple reviews.
- _Cells and results live in memory, not storage_ (`geoLARP-Expo/src/game/usePlay.ts`).
  Privacy: no location history on the device either.

**Leaving the device**

- _Nothing leaves today_ (`geoLARP-Expo/src/claims.test.ts` bans every network call
  and sign-in symbol). It changes in the same commit as the first network code, per
  geoLARP-Expo's AGENTS.md, and that commit must also change the About screen, the
  listing and the App Privacy answers.
- _When game-master games arrive, the exact position leaves, only for adults, only
  to their own game master, only live._ This document.

## Every claim, proofread

"Today" means the current build; "intended" means with game-master games.

| Where                                                          | Claim                                                                | Today                                                                             | Intended                    | Action                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| `geoLARP-Expo/app.json` permission string                      | rounds to a 100 m square; exact position never stored, shown or sent | True                                                                              | False for game-master games | Keep for this version; rewrite in the feature's commit (it names the prompt's purpose).    |
| `geoLARP-Expo/src/app/about.tsx`                               | "What it collects: Nothing", "No network"                            | True                                                                              | Becomes false               | Say "this version", and point to `/app-privacy/` for game-master games.                    |
| `about.tsx`                                                    | "the operating system never hands it a precise position at all"      | Overclaim: the app requests Balanced accuracy, and Android declares fine location | Same                        | Say what the code does: it asks for an approximate fix and rounds it on the phone at once. |
| `geoLARP-Expo/appstore/listing.en-US.json` description         | No account, no network, one permission, no analytics                 | True                                                                              | Becomes false               | Point to `/app-privacy/` for game-master games; rewrite in the feature's commit.           |
| `listing.en-US.json` review notes                              | "It requests no permissions"                                         | False since 9064ab6                                                               | False                       | Fix now, and make `listing.test.ts` check the notes.                                       |
| `listing.en-US.json` `privacyPolicyUrl`                        | `https://geolarp.com/app-privacy/`                                   | 404                                                                               | Needs the page              | This document's page.                                                                      |
| `geoLARP-Expo/tools/appstore-metadata.mjs`                     | prints "App Privacy → Data Not Collected"                            | Defensible                                                                        | False                       | Record the intended answers in the listing and print those.                                |
| `geoLARP-Expo` comments in `field.tsx`, `usePlay.ts`; issue #3 | "no permissions", "zero permission strings"                          | False                                                                             | False                       | Correct them.                                                                              |
| `geoLARP-Expo/README.md`                                       | ScriptHammer's title, bundle id, App Store record, build 1           | False (template leftovers)                                                        | False                       | Correct them.                                                                              |
| `public/blog/the-world-is-the-board.md`                        | "Nothing about you goes to a server", "no tracking to switch off"    | True                                                                              | Becomes false               | A dated update, approved by the owner, before the policy goes live.                        |
| `src/app/terms/page.tsx`                                       | location "is covered in our Privacy Policy"                          | False: it isn't                                                                   | False                       | Link `/app-privacy/`.                                                                      |
| `src/app/privacy/page.tsx`                                     | no location section                                                  | Gap                                                                               | Gap                         | §10 links `/app-privacy/`.                                                                 |
| `src/app/map/page.tsx` consent text                            | rounded before anything is done with it, never leaves your device    | True of the fix; the map-tile provider sees the area on screen                    | Same                        | `/app-privacy/` says so.                                                                   |
| `public/blog/the-world-is-the-board.md`                        | "the game never knows which building you are in"                     | True                                                                              | False for game-master games | The dated update says so, in the post itself.                                              |

## App Store Connect answers (browser only; no API exists)

Recorded in `geoLARP-Expo/appstore/listing.en-US.json` under `appPrivacy`:

- **Precise Location:** collected, linked to the user, App Functionality, not used for tracking.
- **User ID** and **Email Address:** collected, linked, App Functionality (the account
  a game-master game needs).

Declaring these before the build sends anything is the owner's choice (2026-10-10):
the policy describes the intended game, and the label matches the policy.
