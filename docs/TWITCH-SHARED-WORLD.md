# geoLARP + Twitch: The Stream Is the Shared World

**Status:** Brainstorm captured 2026-10-26 (Jonathan). Not yet scoped. Nothing here is built.
**Repo:** TortoiseWolfe/geolarp (geolarp.com). Mobile client: TortoiseWolfe/geoLARP-Expo.
**Companion design:** `combined-arms-prd.md` (Project COMBINED ARMS — the red-vs-blue squad game this layer can report on).

---

## The idea, in Jonathan's words (2026-10-26)

The Twitch channel is the shared world of the game.

Players play their geoLARP (geo-located live action role playing) characters on their mobile phones, out in the real world. Anything a character does that affects the shared world — and is not secret to that player individually — shows up on the stream:

- The news
- The radio
- Political announcements
- Major actions appearing on the shared map
- A scoreboard of events and statistics between players

Say there are 25 red players and 25 blue players: they all show up on the map online, on the stream, affecting each other in real time.

The audience is part of the loop too. The app gets an easy feedback button — "hey, let's add this feature" — and that suggestion streams straight into features to be developed, or GitHub issues to be developed. The audience helps influence the design of the game as it goes along.

### Channel plan (Jonathan, same note)

- This may eventually deserve its own Twitch channel — a third channel is probably the best long-term option.
- It spins up first on **ScriptHammer**, which already runs a Star Wars game and runs most of the day.
- Rough split on ScriptHammer: about half the time geoLARP, the other half the educational content and Star Wars gaming it already does.
- Whatever gaps ScriptHammer has in its schedule, geoLARP fills them — the game is coordinated through players' mobile phones, so the world is live whenever players are.

---

## The one rule that makes it work

**Public world events go to the stream. Private player information never does.**

Every game event gets classified when it happens:

| Class | Meaning | Goes to stream? |
| --- | --- | --- |
| World | Affects other players or the shared map (a capture, an election result, a territory flip) | Yes, immediately |
| News | Not world-changing, but public (a score milestone, a rivalry result, a streak) | Yes, on the ticker / scoreboard |
| Private | Secret to that player (their exact location in stealth, a hidden quest, a private message) | Never |

If a new mechanic cannot say which class its events are, it is not ready to design yet.

---

## What the stream shows (brainstorm additions — H-7CH, for Jonathan to cut or keep)

### 1. The World Map (the main screen)
- The shared map with red and blue presence, territory, and control points flipping live.
- This is a web page used as a browser source in OBS (Open Broadcaster Software, the streaming program) — geoLARP already has `/map/` and `/game/` routes and a Supabase Realtime backend (the live-updating database service the app already talks to), so the stream screen is a new view on data that already moves in real time, not a new system.
- **Anti-cheat guard:** the public map must not leak what a phone player could use against another player. Show zones and counts, not exact pins, and run the stream on a delay (60–120 seconds is the usual range). Exact positions stay private class.

### 2. The News Desk
- Big events interrupt like breaking news: "Red takes the river crossing," "Blue's mayor wins re-election."
- A text-to-speech (TTS, computer voice) radio / news voice reads the desk — this fits the fleet: a bot anchor can run the channel when no human is hosting.
- Every news item is also a permanent record: a world history / newspaper archive players can read in the app later.

### 3. The Ticker and Scoreboard
- When nothing major is happening, the stream is still alive: a rolling ticker of minor events and a scoreboard — team totals, territory percentage, top players, win streaks, captures today.
- This is what keeps a 24-hour channel watchable during quiet hours instead of showing a dead screen.

### 4. Factions at scale (the 25v25 picture)
- Red vs blue is the starter shape (it matches COMBINED ARMS). The map shows momentum: which side is gaining ground this hour, this day, this season.
- Seasons give the stream a story arc: a season ends, a winner is declared on stream, the map resets, the archive keeps the history.

### 5. Audience powers (chat affects the world, carefully)
- Chat polls with real but bounded effects: vote for the next world event, a supply drop location, a bounty on a player (public class, announced, so it is a game event and not a leak), or which feature gets built next.
- Keep audience powers on a budget — a vote can nudge the world, never override a player's private game.

### 6. The feedback button (play → suggest → watch it get built)
- One big button in the mobile app: "Suggest a feature."
- A suggestion becomes a GitHub issue in this repo automatically, labelled `player-feedback`, with the player's name and the suggestion in their words.
- On stream, suggestions get read, voted on, and the winners become the next build items — and ScriptHammer is the factory channel, so players can literally watch their idea get built live, then play it.
- That loop is the pitch: **the players and the audience are designing the game while playing it.**

### 7. Idle mode (the channel never sleeps)
- When no players are online, the stream does not go dark: map + season stats + news archive + replays of the day's biggest moments + the open feature-vote board.
- A 24-hour world channel needs a night shift that runs itself; the fleet's bots are that night shift.

---

## How it fits the channels

| Option | Verdict for now |
| --- | --- |
| ScriptHammer gap-filler, ~half its day | **Start here** (Jonathan's call, 2026-10-26) |
| Bounce between TurtleWolfe and ScriptHammer | Possible, messy for viewers — a world channel should live in one place |
| Third dedicated channel (geoLARP TV, 24 hours) | **Best long-term option** (Jonathan's call) once the game has steady players |

TurtleWolfe stays the builder channel — geoLARP development streams there are content *about* the game. The world channel is the game itself.

---

## First buildable slice (proposed, smallest thing that proves the idea)

1. A `world_events` feed in the existing backend: every public event already happening in the game (join, capture, score milestone) written with its class (world / news / private).
2. A `/broadcast` page in this repo: full-screen map + ticker + scoreboard, no controls, built to sit in OBS as a browser source.
3. One TTS news voice reading world-class events.
4. The in-app "Suggest a feature" button creating a GitHub issue in this repo.

Everything else (audience powers, seasons, the third channel, the news archive) comes after that slice is live on ScriptHammer.

---

## Open questions (for Jonathan / fleet design pass)

- Delay length on the public map, and how coarse the public positions should be.
- Does the news voice belong to an existing fleet character, or is the anchor a new character?
- Feature-vote rules: who can vote, how often, and who has the final say when a voted feature is a bad idea?
- Season length, and what the winning side actually wins.
- Twitch automated-account rules for a 24-hour bot-run channel — still unverified in the AFA (Action Figure Automata, the fleet) plan; this idea makes that check urgent, not optional.
