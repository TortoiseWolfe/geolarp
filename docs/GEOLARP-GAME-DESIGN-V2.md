# geoLARP game design, version 2

**Status:** draft for Jonathan's review. Approved in outline on 4 Nov 2026; this file is the written form.
**Supersedes nothing in the repo.** Version 1 of the design lived outside the repo and is retired (see "What version 2 is").
**Companion:** the Twitch shared-world layer is written up in [the Twitch shared world design (pull request 188, still a draft)](https://github.com/TortoiseWolfe/geolarp/pull/188), file `docs/TWITCH-SHARED-WORLD.md`. That file is not on `main` yet, so it is linked here rather than edited. The stream slice is tracked in [the stream slice ticket (issue 189)](https://github.com/TortoiseWolfe/geolarp/issues/189).

Acronyms are spelled out the first time they appear: GPS (Global Positioning System, the phone's location sensor), UTC (Coordinated Universal Time, the world clock that has no daylight saving), LARP (live action role play), GM (game master, the person who runs a game for others), CP (Character Points, defined below).

## What version 2 is

geoLARP is a steampunk tabletop-style role-playing game played by walking. The street is the board and the phone is the character sheet. Version 1 borrowed mechanics from Combined Arms (a separate first-person-shooter concept: spawn points, control points, teams). Those mechanics do not apply here, and version 1 is not a source for anything below.

## The game

1. **Street is the board, phone is the sheet.** You play where you stand.
2. **No spawn points.** The character is at the device's most accurate GPS fix, exactly (see `src/lib/geolarp/deviceFix.ts`, from [the change that kept the exact position (#183)](https://github.com/TortoiseWolfe/geolarp/pull/184)). There is no respawn, rally point or teleport.
3. **Cells.** The world is cut into hexagonal cells 100 metres across (`src/lib/geolarp/cell.ts`). The cell's coordinates plus the date seed one thing in it: a monster, a trader, a cache, a shrine or a trap, with a difficulty on the ladder. The result is fixed for the day and is the same for every player. It can be worked out on the phone with no network, because nothing has to be fetched to know what a cell holds.
4. **The sheet.** Dice use the West End Games D6 code: a code like 3D+2 means roll three six-sided dice and add two. One die is the "wild die": it can explode (roll again and add) or bring a complication. A character has 5 attributes (Strength, Agility, Intellect, Spirit, Luck) that start at 15D to share out, and 20 skills that start at 7D and begin at their attribute. A character starts with 5 Character Points, which buy extra dice on a roll.
5. **Economy.** A win pays Character Points by band: trivial 0, Moderate and Difficult 1, Very Difficult 2, Heroic 3. At most 5 points can be earned per day. A loss costs only the chance: no damage, no death.
6. **Privacy.** The character lives in the player's browser. The player can export it to a file or a QR code, and is responsible for keeping that copy; the app warns before anything is lost. Adults share their exact location with the players and game masters they are playing with, while they play. There is no location history. Location is never sold and never used for advertising.
7. **A session** is about half a mile of walking. The fiction is steampunk: an automaton, a tinker-trader, a smuggler's cache, a Gear-Saints wayshrine, a steam-snare. The name and tone of the fictional world are open (see "Open items").
8. **The Twitch layer stands.** The shared-world feed on Twitch keeps its three classes (world, news, private; private never surfaces). Red-versus-blue is that layer's storytelling only, not a game rule.

## Business model

- **Free core, forever.** Encounters are worked out on the device, so the cost of one more player is close to nothing. The site is static, plus a small managed backend.
- **Tier 1, Adventurer (about $3 to $5 a month):** a cloud vault for exports, extra character slots, cosmetic sheet themes, early encounter tables. The character stays exportable.
- **Tier 2, Game Master (about $5 to $6 a month):** campaign tools, a private party map, custom quest lines.
- **Ticketed hosted steampunk walks.**
- **Later, at scale:** sponsored trader and shrine places (Pokémon GO's sponsored places charge about $30 and $60 a month), aggregated metrics only, never player location.
- **Sketch:** about 250 subscribers at about $4 is about $1,000 a month, which covers costs. Audience is the risk, not cost.

## Design on Air: the episode slate

The series is called "Building geoLARP". Each episode opens cold on the street, says what changed because of the audience, puts ONE open design question to the audience (chat votes, plus an in-app "Suggest a feature" button that files GitHub issues labelled `player-feedback`), builds live, then field-tests. The series builds on TurtleWolfe; the live world runs on ScriptHammer.

1. Your Character Is Where You Stand (the audience also names the world)
2. Does the Seven Hold Up?
3. What's in a Cell?
4. When Two Players Meet
5. The Economy of a Walk
6. The Half-Mile Test (season verdict, and the go or no-go on the stream slice, issue 189)

## Open items (not settled here)

- **Player-meeting rules** (episode 4). Nothing in this file decides them.
- **The fiction world's name** (episode 1, audience).
- **The free-sheet character limit**, meaning how many characters a free player keeps. Nothing below may be read as choosing a number.
- Episode 1 field-test ground (Chattanooga or Cleveland, Tennessee), its time slot and the camera plan: waiting on Jonathan.
- Each finding below marked "owner call".

## Design pass: where version 2 meets the code and the blog

Ten places where version 2 contradicts the code or what the blog and privacy page promise, then two notes. Line numbers are on `main` at commit 1d7e3f76.

| #   | Version 2 says                            | The code or published text says                                                                                                                                                                                                                      | Where                                                                                | Fix                                                                                                                                                     |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cells are "fixed until midnight"          | Cells reseed at UTC midnight, so in Chattanooga they change at 7 or 8 PM local time. The Character Points daily cap uses the same clock.                                                                                                             | `cell.ts:203-219`, `reward.ts`                                                       | Say UTC midnight, or choose local midnight (owner call)                                                                                                 |
| 2   | Nearby cells as a 3x3 grid                | The library uses a 7-cell hex flower; the 3x3 grid was replaced. The blog line is stale.                                                                                                                                                             | `cell.ts:322-335`, `CellGrid.tsx:44-86`, `public/blog/the-world-is-the-board.md:81`  | Say "seven cells"; correct the blog                                                                                                                     |
| 3   | D6 dice codes                             | The blog promises advantage and disadvantage (two d7, keep highest or lowest) and attributes "on the same 1-7 scale as the die". The library has dice codes and no advantage. Version 2 matches the library and contradicts the blog.                | `character.ts:71-73`, `dice.ts`, blog `:52-55`                                       | Correct the blog (owner call)                                                                                                                           |
| 4   | Pips "rolled on d7"                       | Pips are a flat add (0, 1 or 2; three pips make one die), not rolled                                                                                                                                                                                 | `dice.ts:12-19`, `:103`                                                              | Reword                                                                                                                                                  |
| 5   | Economy is band pay only                  | A critical (wild die's first face is 7) pays base plus 1, only when base is above 0. A complication pays 0 even on a success. Success means total at or above the band floor. Only the first win per cell per session pays.                          | `reward.ts:64-73`, `ladder.ts:27-34`, `:60`, `useCharacterPlay.ts` around `:407-411` | Add these rules to the economy                                                                                                                          |
| 6   | Character Points "spendable on rolls"     | Correct: one extra die each. But a code comment calls them "a reroll".                                                                                                                                                                               | `dice.ts:75-81`, `character.ts:289`, comment near `:106`                             | Fix the stale comment                                                                                                                                   |
| 7   | Early encounter tables for paying players | The blog promises every player sees the same cell, and the cell's content comes only from its seed. Content that depends on a subscription breaks that.                                                                                              | `cell.ts:203`, blog `:74-77`                                                         | Keep it cosmetic, or announce the change (owner call)                                                                                                   |
| 8   | Cloud vault and extra slots               | The blog says the character "lives in your browser", and storage is one key. An optional vault is compatible, but the privacy page and blog must say so.                                                                                             | `character.ts:347`, `src/app/app-privacy/page.tsx`, blog `:98-101`                   | Update both pages before the vault ships                                                                                                                |
| 9   | Sponsored trader and shrine places        | The privacy page says "We do not sell it or use it for advertising, and we share it only with the people playing". Aggregate metrics for sponsors are still location-derived data given to a third party.                                            | `src/app/app-privacy/page.tsx:95-97`, blog `:92-93`                                  | Owner call and a privacy-page rewrite before any sponsor                                                                                                |
| 10  | The Twitch layer "stands"                 | The pull request 188 file names `combined-arms-prd.md` as its companion and builds 25 versus 25 control points. It also shows red and blue presence on a public stream, while the privacy page says location is shared only with the people playing. | pull request 188 file `docs/TWITCH-SHARED-WORLD.md`                                  | Reword its rules sections to storytelling only; make the privacy page say what the stream shows (delayed, zone and count only, as 188 already proposes) |

Notes (not contradictions):

- **11. Fiction names.** Library encounter titles are generic (`encounter.ts:44-84`). The place-name rule bans "saints" in place names so a made-up place cannot read as a real address (header of `place.ts`). "Gear-Saints wayshrine" is an encounter title, so it does not break the rule, but check it before it is used as a place name. The blog (`:133-136`) calls the fiction open; this file says steampunk is settled and the name is open.
- **12. Movement.** "No teleport" is true by default. Older zone-pick and step modes are still in the code, switched off (`playModes.ts`, `useCharacterPlay.ts`), kept on the owner's order (`docs/privacy/location-intent.md`).

Checked and consistent: hex size 100 m (`cell.ts:15`), five kinds, 15D and 7D and 20 skills and 5 starting points, the daily cap of 5, the band pay table, no damage track (`reward.ts:14-20`), working offline, the half-mile target (blog `:105`), no location history (privacy page `:69`). One stale comment: `cell.ts:131-133` says `cellOf` is the only function that sees a raw GPS reading; `deviceFix.ts` also reads it.

## Gap list: sheet, location fix, nearby cells, encounter, roll, reward

Nothing is built by this file. "Exists" means the code and a test are on `main`.

| #   | Step                                       | State   | Files and notes                                                                                                                           |
| --- | ------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sheet: make, store, export, import         | Exists  | `character.ts:211-474`, `CharacterSheet.tsx`                                                                                              |
| 2   | Warn before the sheet is lost              | Exists  | `exportedAt`, `markExported` in `character.ts:455`                                                                                        |
| 3   | Export as a QR code                        | Missing | Only a JSON file today; no QR library in the project                                                                                      |
| 4   | Exact device fix                           | Exists  | `deviceFix.ts`, `tests/unit/device-fix.test.ts`                                                                                           |
| 5   | Fix feeding play, walking continuously     | Partial | Only `MapContainer.tsx` uses `getDeviceFix`; play uses the `useGeolocation` hook and `setCellFromFix`, not the continuous watch           |
| 6   | Nearby cells shown                         | Exists  | `cell.ts:325`, `CellGrid.tsx` (seven hex cells with kind and difficulty)                                                                  |
| 7   | Encounters drawn on the real map           | Missing | Needs the cell centres on the map; entering a neighbour only by walking                                                                   |
| 8   | Encounter from a cell                      | Exists  | `encounter.ts`, `EncounterCard.tsx`, `place.ts`, golden vectors `__vectors__/golden.json`, `geolarp-golden-vectors.test.ts`               |
| 9   | Steampunk encounter content                | Partial | Titles are generic (`encounter.ts:44-84`); no fiction table                                                                               |
| 10  | Roll                                       | Exists  | `dice.ts`, `D7Roller.tsx`, `odds.ts`                                                                                                      |
| 11  | Advantage and disadvantage, if kept        | Missing | Decide in finding 3 first                                                                                                                 |
| 12  | Reward and daily cap                       | Exists  | `reward.ts`, tests `geolarp-reward.test.ts`, `economy-invariants.test.ts`; one payout per cell per session, held in memory only by design |
| 13  | More than one character slot               | Missing | One storage key today                                                                                                                     |
| 14  | Cloud vault, subscriptions, entitlements   | Missing | Needs Supabase work                                                                                                                       |
| 15  | "Suggest a feature" filing a GitHub issue  | Missing | Needs a Supabase Edge Function (the site is static)                                                                                       |
| 16  | Players seeing each other, meeting         | Missing | The blog (`:137`) implies it; no code found; the rules are an open item                                                                   |
| 17  | World events feed, broadcast, Twitch layer | Missing | Issue 189 and pull request 188                                                                                                            |
| 18  | End-to-end test of a real walk             | Partial | `tests/e2e/character-played.spec.ts` exists; walking outdoors is untested until the episode 1 field test                                  |

Total 18: 7 exist, 3 partial, 8 missing.
