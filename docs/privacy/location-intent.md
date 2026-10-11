# Location: the rule, and what has to match it

This is the reasoning behind `/app-privacy/` (`src/app/app-privacy/page.tsx`), and
the list of every place that has to say the same thing.

## The rule, in the owner's words (2026-10-10)

- _"kids can't play, everyone shares their full location all the time"_
- _"if you don't want to share your location don't play"_
- _"I don't want anything about a 100 meter close enough … because it's not"_
- _"no rounding or vaguing, as accurate as we can get"_

So:

- **geoLARP is for adults, 18 and over.** Children cannot play.
- **Everyone who plays shares their exact location** with the other players and game
  masters, all the time, as precisely as the phone can give it.
- **There is no opt-out.** If you don't want to share your location, don't play.
- **No history is kept** of where anyone went.
- **The App Store label is "Precise Location"**, collected and linked to the account,
  for App Functionality, and never used for tracking.

The 100-metre cells are only how encounters are generated. They are never a limit
on how precisely a player's location is known or shared, and the privacy text does
not mention them.

## What has to match

| Where                                                    | Says                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/app-privacy/page.tsx`                           | The rule above. `tests/unit/app-privacy-page.test.tsx` pins it, and fails on any 100 m, rounding, opt-out, solo or under-18 wording. |
| `src/app/terms/page.tsx`, `src/app/privacy/page.tsx` §10 | 18 and over; children cannot play.                                                                                                   |
| `src/components/game/CharacterPlay/CharacterPlay.tsx`    | "For adults, 18 and over".                                                                                                           |
| `public/blog/the-world-is-the-board.md`                  | "Where you are, and who knows it": the rule, in the post itself.                                                                     |
| geoLARP-Expo `appstore/listing.en-US.json` `appPrivacy`  | Precise Location, User ID, Email Address; linked; App Functionality; not tracking.                                                   |
| geoLARP-Expo About, `app.json` permission string         | The exact location, and the policy's rule.                                                                                           |

## What the code still has to do

None of the sharing exists yet. Today the app sends nothing, which the policy
over-discloses on purpose.

- **Sharing:** a server, accounts, and the live positions of every player, sent to
  the other players and game masters. In geoLARP-Expo, `src/claims.test.ts`, About and
  the listing change in the same commit as the first network code (`AGENTS.md`).
- **Precision:** geoLARP-Expo `fix.ts` now asks for BestForNavigation and keeps the
  exact position (cd3907e). The website's `coarseFix.ts` still rounds it away (#183).
- **Age:** the 18+ rule is stated, not checked. The website has no date-of-birth field.
- **"All the time":** the app reads location only while it is open, and only when a
  player presses Find my cell. Continuous sharing needs a watch (geolarp#90). Sharing
  while the phone is locked needs Apple's Always permission, which `audit:plist`
  forbids today.
- **Refusing location:** the ways to play without it (the website's zone and grid
  modes, the app's grid movement) are archived, not deleted: the owner's instruction
  was "archive them for later if we revisit it, don't delete them yet". One switch per
  repo, `LOCATION_FREE_MODES` (geolarp `src/components/game/CharacterPlay/playModes.ts`
  in #184, geoLARP-Expo `src/game/playModes.ts`), is off. Their tests still run with it
  on.
