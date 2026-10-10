# Location: what the game knows, what leaves the device, and what we say

Written 2026-10-10. This is the proofread of every location claim against what the
game is meant to become, and the record of the decisions behind
`/app-privacy/` (`src/app/app-privacy/page.tsx`).

## The intent, as the owner set it

- **Adult players can see the players near them.** In the owner's words: _"best
  game dynamics all players 'would' have the ability to see other players they are
  near unless cloaked or 'fog of war' but at privacy level best game play dynamics
  are when other players 'can or might' know your location, it could show on their
  radar if you're in the same proximity."_
- **Each player controls it.** _"it can be turned off or blocked or just shared with
  players under the same game master."_ The game can also hide a player (cloaking,
  fog of war).
- **A game master sees their players' exact positions.** _"adults are more accurate
  than a 100 meter square, the game master is trusted by their players and needs
  complete accuracy, you should know your game master."_
- **Only while playing.** Positions are not kept as history.
- **The phone knows exactly where you are, solo or not.** _"solo play your phone still
  needs precision of where you are, no rounding or vaguing, as accurate as we can get,
  it's hurting game dynamics to not even have that option for adult players solo or
  not."_ The 100 m square is what encounters are built from, not a cap on what the
  phone knows.
- **Adults and minors play different versions.** Under-18s play solo only. Solo play may
  also be split by age; precision on the phone is not what differs.
- **The policy describes the game as designed**, in its two modes, not the history of
  the build.

The rule underneath is the owner's: _"we still have to know where the player or at
least their device is, but we can't let that leak."_ **A leak is a position reaching
someone the game does not mean to show it to**, or being kept after play. Being seen
by the players near you is the game working, and the player can turn it off, block
players, or keep it within one game master's game.

## The design the policy states

|                      | Solo play                                                                        | Playing with others (not built yet)                                               |
| -------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Who                  | Anyone 13 and over                                                               | Adults (18 and over) only                                                         |
| What the device does | The most precise position the phone gives; encounters come from the 100 m square | Same, with fixes while you play                                                   |
| Who can see you      | Nobody                                                                           | Players near you (for example a radar); your game master sees your exact position |
| Your controls        | None needed                                                                      | Turn it off, block players, or share only within one game master's game           |
| Game effects         | None                                                                             | Cloaking and fog of war can hide you                                              |
| How long             | Not kept anywhere                                                                | Only while you play; forgotten when you stop or the game ends                     |
| Account              | None                                                                             | Needed, so players and game masters know who is who                               |

Under-18s never send a position. That is the "different version": the whole of
today's game, without the feature that puts a position on a server.

**Know your game master** is the safety model for game-master games: the players'
own trust, not platform vetting.

**Apple's label is "Precise Location"**, because a game master can see the exact position.

**Left to the game's design, and so not promised in the policy:** how precisely other
players see you (a radar can show "near" without a pin), whether sharing starts on or
off, what cloaking and fog of war hide and for how long, how age is confirmed (the
website has no date-of-birth field today), and what a game master can do beyond
seeing positions.

**What playing with others will need from the code** (none of it exists yet):

- Repeated fixes while you play, which is geolarp#90's watch, and its dwell
  rule against cell flicker.
- Whether the game keeps tracking the player while the phone is locked. Background
  location is forbidden today by `audit:plist` and needs a justification that Apple
  reviews.
- The controls the policy promises: off, block, keep it within one game master's
  game. They must ship with the feature, because the policy already names them.

## Why each location rule exists

Sorted by where the thing it protects lives.

**On the device**

- _One fix per press, never a watch_ (`geoLARP-Expo/src/game/fix.ts`). Gameplay,
  not privacy: one fix per press stops a player flickering between cells at a
  boundary. geolarp#90 is the issue for a watch, and it needs the dwell rule first.
- _Coordinates died inside the function that rounded them, from a deliberately rough
  reading_ (`fix.ts`'s Balanced accuracy, `src/lib/geolarp/coarseFix.ts`). **Retired:** the
  owner wants the most precise position on the phone. The app now asks for its best
  reading and keeps it (geoLARP-Expo); the website's `coarseFix.ts` still rounds and is
  tracked separately. What stays is the single door: only `fix.ts` reads the OS.
- _No map and no dot in the app_ (`geoLARP-Expo/src/app/field.tsx`). Not a privacy
  rule any more: a precise dot on the device is exactly what the owner wants possible.
  A design choice for the game.
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
- _When playing with others arrives, positions leave, for adults only, to the
  players near them and their game master, live only, under the player's controls._
  This document.

## Every claim, proofread

"Today" means the current build; "intended" means with playing with others.

| Where                                                          | Claim                                                                | Today                                                          | Intended                      | Action                                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| `geoLARP-Expo/app.json` permission string                      | rounds to a 100 m square; exact position never stored, shown or sent | False to the owner's intent                                    | False                         | Rewritten: the exact location, used to play; solo, it never leaves the phone.      |
| `geoLARP-Expo/src/app/about.tsx`                               | "What it collects: Nothing", "No network"                            | True                                                           | Becomes false                 | Say "this version", and point to `/app-privacy/` for playing with others.          |
| `about.tsx`                                                    | "the operating system never hands it a precise position at all"      | Overclaim, and the opposite of the intent                      | Same                          | Rewritten: the app asks for the most precise reading the phone can give.           |
| `geoLARP-Expo/appstore/listing.en-US.json` description         | No account, no network, one permission, no analytics                 | True                                                           | Becomes false                 | Point to `/app-privacy/` for playing with others; rewrite in the feature's commit. |
| `listing.en-US.json` review notes                              | "It requests no permissions"                                         | False since 9064ab6                                            | False                         | Fix now, and make `listing.test.ts` check the notes.                               |
| `listing.en-US.json` `privacyPolicyUrl`                        | `https://geolarp.com/app-privacy/`                                   | 404                                                            | Needs the page                | This document's page.                                                              |
| `geoLARP-Expo/tools/appstore-metadata.mjs`                     | prints "App Privacy → Data Not Collected"                            | Defensible                                                     | False                         | Record the intended answers in the listing and print those.                        |
| `geoLARP-Expo` comments in `field.tsx`, `usePlay.ts`; issue #3 | "no permissions", "zero permission strings"                          | False                                                          | False                         | Correct them.                                                                      |
| `geoLARP-Expo/README.md`                                       | ScriptHammer's title, bundle id, App Store record, build 1           | False (template leftovers)                                     | False                         | Correct them.                                                                      |
| `public/blog/the-world-is-the-board.md`                        | "Nothing about you goes to a server", "no tracking to switch off"    | True                                                           | Becomes false                 | Edited in place: no one has the game yet, so no retraction note.                   |
| `src/app/terms/page.tsx`                                       | location "is covered in our Privacy Policy"                          | False: it isn't                                                | False                         | Link `/app-privacy/`.                                                              |
| `src/app/privacy/page.tsx`                                     | no location section                                                  | Gap                                                            | Gap                           | §10 links `/app-privacy/`.                                                         |
| `src/app/map/page.tsx` consent text                            | rounded before anything is done with it, never leaves your device    | True of the fix; the map-tile provider sees the area on screen | Same                          | `/app-privacy/` says so.                                                           |
| `public/blog/the-world-is-the-board.md`                        | "the game never knows which building you are in"                     | True                                                           | False for playing with others | The post now scopes it to solo play.                                               |

## App Store Connect answers (browser only; no API exists)

Recorded in `geoLARP-Expo/appstore/listing.en-US.json` under `appPrivacy`:

- **Precise Location:** collected, linked to the user, App Functionality, not used for tracking.
- **User ID** and **Email Address:** collected, linked, App Functionality (the account
  playing with others needs).

Declaring these before the build sends anything is the owner's choice (2026-10-10):
the policy describes the intended game, and the label matches the policy.
