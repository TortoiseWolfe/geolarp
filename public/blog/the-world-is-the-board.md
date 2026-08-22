---
title: 'The World Is the Board: What geoLARP Actually Is'
author: TortoiseWolfe
date: 2026-08-22
slug: the-world-is-the-board
tags:
  - geolarp
  - game-design
  - d7
  - geolocation
  - beta
categories:
  - ideas
excerpt: geoLARP turns the street outside into a game board and your phone into a character sheet. Here is the design so far, including a seven-sided die and encounters made of coordinates, and the parts still open enough for you to change.
featuredImage: /blog-images/the-world-is-the-board/featured-og.svg
featuredImageAlt: 'A seven-sided die beside the geoLARP wordmark, over a 100-metre grid'
ogImage: /blog-images/the-world-is-the-board/featured-og.png
ogTitle: 'The World Is the Board: What geoLARP Actually Is'
ogDescription: Geo-located live action role-playing built on a seven-sided die and a 100-metre grid. The design is real, the game is not finished, and the open questions are still open.
twitterCard: summary_large_image
---

# 🎲 The World Is the Board: What geoLARP Actually Is

There has been a domain, a mark, and a coming-soon page for a while now, and no
explanation of what any of it is for. So here is the design, plainly, including
the parts I have not settled.

The short version: **geoLARP is geo-located live action role-playing.** The street
outside is the board. Your phone is the character sheet. You walk somewhere, and
something is there — not because a designer placed it, but because that patch of
ground and today's date hash to it.

## 🎲 Why a seven-sided die

Every tabletop system picks a die and inherits its personality. geoLARP runs on
**1d7**, and that is not a gimmick — it changes the feel of play in a way you can
calculate.

|                  | d20  | d6    | **d7**    |
| ---------------- | ---- | ----- | --------- |
| each face        | 5%   | 16.7% | **14.3%** |
| average roll     | 10.5 | 3.5   | **4.0**   |
| critical success | 5%   | —     | **14.3%** |

A natural 20 lands about once every twenty rolls. A **natural 7 lands about once
every seven** — nearly three times as often. Criticals stop being a rare
fireworks moment and become a texture you plan around. The same is true at the
bottom: a natural 1 complicates things about as often as a 7 saves them, so the
game keeps handing you both.

Advantage is `2d7 keep highest`; disadvantage keeps the lowest. Attributes —
**Strength, Agility, Intellect, Spirit, Luck** — sit on the same 1–7 scale as the
die, so a character sheet reads in the same units as the roll. That symmetry is
most of why the system is worth the trouble.

You may have noticed the site's mark is a seven-sided die. That is not
decoration. It is the one design decision everything else is built on, so it may
as well be the logo.

> A physical d7 is geometrically impractical — you cannot fairly divide a solid
> into seven equal faces the way you can into six or twenty. The digital-only
> constraint is not a compromise for a phone game. It is the reason this die can
> exist at all.

## 🗺️ Encounters made of coordinates

The world is divided into **100-metre cells**. Each cell's coordinates are hashed
into a seed, and that seed generates what is there — a monster, a trader, a cache,
a shrine, a trap. Five kinds, scaled by a challenge rating tuned to the d7 curve.

Two consequences fall out of that, and they are the whole reason for the design:

**It is the same for everybody.** No server assigns you an encounter. The corner
of your street holds the same thing for you as for the person who walks past an
hour later, because it is derived from the place, not handed out. That is what
makes it a shared world rather than a private one.

**It works with nothing behind it.** No matchmaking, no world state, no database
of what is where. Your device can generate the 3×3 grid of cells around you while
completely offline, from map tiles it cached earlier.

## 🔒 The privacy design is the same design

This is the part I am most pleased with, so I want to be exact about it.

Location is rounded to **100 metres before anything is done with it** — and that
rounding is not a privacy feature bolted on afterwards. It is the grid. The
coarseness that makes encounters stable is the same coarseness that means the game
never knows which building you are in.

So there is no tracking to switch off, and no location history to leak, because
none is collected. Deny the permission entirely and it still plays: it falls back
to a coarse network location, a zone you pick by hand, or grid movement with no
GPS at all.

## 🚶 What playing actually looks like

You generate a character in well under a minute — the target is ten seconds — and
it lives in your browser's storage. You can export it as a file or a QR code and
carry it to another device. Nothing about you goes to a server, which is also why
**you** are responsible for that export; clearing your browser data clears your
character, and the game will warn you rather than quietly lose it.

Then you go outside. Quests are built around real distance — walk a quarter mile
and see what is at the other end. The design target is about half a mile of actual
walking in a session. This is a game that only works if you move.

## 🏗️ What exists today, honestly

I would rather undersell this than have you click through to a disappointment.

**Playable now, and worth your time:**

- 🌆 A [3D digital twin of Chattanooga](https://geolarp.com/chatt/) — around eight
  thousand buildings at real rooftop heights, over the real street grid, from open
  data, with no server behind it
- 🚲 [First-person walking and cycling through it](https://geolarp.com/blog/ride-the-open-source-city),
  on an asset-free procedural engine that ships zero texture or model files
- 🧱 A bare [test level](https://geolarp.com/game/cod-skeleton) proving the engine
  is reusable rather than one scene in a trenchcoat

**Designed, specified, not yet a game you can play:** the d7 system, the character
model, the encounter engine, the offline map layer. The specifications are written.
The game is not finished. There is no beta build to hand you today, and the signup
form on the front page is the honest version of that — it takes an address and
tells you nothing else has happened yet.

## 🙋 The part where you come in

This is early enough that the interesting version of this game is not the one I
sketch alone. Some questions I genuinely have not answered:

1. **What is the fiction?** The mechanics are specified; the _world_ is not. Is
   this fantasy laid over the real street, near-future, folk-horror, something with
   no combat in it at all? The encounter types — monster, trader, cache, shrine,
   trap — are placeholders wearing familiar clothes.
2. **What happens when two players are in the same cell?** Right now the design is
   single-player-shaped with a shared world. Co-op, competition, or simply
   knowing someone else has been here — each pulls the design somewhere different.
3. **How much walking is too much?** Half a mile a session is a guess. It is the
   difference between a game you play on a commute and one you make a trip for,
   and I do not know which this should be.
4. **Does the seven hold up in play?** Criticals landing three times as often as
   d20 reads well on paper. Whether it feels generous or chaotic is not something
   arithmetic can tell me.

If any of that makes you want to argue with me, that is exactly the point. The
**Notify me** box on the [front page](https://geolarp.com) is where to start —
it is a real list now, stored properly, and it will be used once, to tell you when
there is something to play. If you would rather argue in public than wait, the
[playable-city brainstorm](https://geolarp.com/blog/playable-city-chattanooga)
has its own open questions and the door propped open the same way.

Come help decide what this is while it is still deciding.
