# Resolution: the d7 System

**Feature**: `052-character-model`
**Created**: 2026-08-22
**Status**: Draft — **design decision, not transcription**
**Fills**: [`spec.md`](spec.md) §1 ⚠️ UNSPECIFIED — *"what a roll is made against. No target numbers, difficulty ladder, or success/failure bands are published."*
**Derived from**: West End Games' D6 System (OGL v1.0), converted d6 → d7
**Owner decision**: use WEG D6 (2nd edition, Star Wars) as the source system and make it a d7 system

---

## Why this is a separate file

`spec.md` transcribes what the blog already published and **invents nothing** — that is its whole value, and its §9 makes it a pass/fail condition: *"No mechanic appears here that does not appear there."* It also sets the rule for this document: *"Filling [a gap] is a design decision that belongs in a follow-up, not an inference from this file."*

This is that follow-up. Everything here is a **choice**, not a transcription. Where a choice was already published, this file says so and defers to `spec.md`.

## 1. The core roll

Attributes and skills are rated in **dice and pips**, written `3d7+2` — roll three d7, sum them, add two, compare to a difficulty number.

**1D = 3 pips**, exactly as in D6. `Xd7+3` is not a rating; it becomes `(X+1)d7`.

> **On the pip economy.** A die adds its average, a pip adds exactly 1, so the value a die returns per pip it costs shifts when the die does: D6 sits at 3.5/3 = 1.167, and a d7 at three pips is 4.0/3 = 1.333. Dice get slightly better value relative to pips than in D6, which nudges advancement a little harder toward whole dice.
>
> Keeping 3 is the right call anyway. It is D6's rule, the notation is the notation players already know, and the drift is small enough to be a playtest question rather than a design one. Four pips would flatten the die-over-pip preference that gives D6 advancement its shape — the opposite of preserving the system.

## 2. Difficulty ladder

Rescaled ×8/7 from D6's, because the per-die mean moves 3.5 → 4.0.

| Band | d7 target | (D6 original) |
|---|---|---|
| Very Easy | **2–6** | 2–5 |
| Easy | **7–11** | 6–10 |
| Moderate | **13–17** | 11–15 |
| Difficult | **18–23** | 16–20 |
| Very Difficult | **24–34** | 21–30 |
| Heroic | **35+** | 31+ |

**Calibration check.** D6's benchmark is an average character (3d6) against Moderate (11+) at **50.0%**. The d7 equivalent, 3d7 against 13+, gives **44.6%**. The ladder's feel transfers.

Reference probabilities (roll ≥ band floor):

| pool | Very Easy | Easy | Moderate | Difficult | Very Difficult | Heroic |
|---|---|---|---|---|---|---|
| 2d7 | 100% | 69% | 6% | 0% | 0% | 0% |
| 3d7 | 100% | 94% | 45% | 6% | 0% | 0% |
| 4d7 | 100% | 99% | 80% | 36% | 3% | 0% |
| 5d7 | 100% | 100% | 95% | 71% | 22% | 0% |

⚠️ **UNSPECIFIED:** how a cell's challenge rating (`spec.md` §4, published at `:70` with no definition) maps onto these bands.

## 3. The Wild Die — already published, no conversion needed

One die in every pool is the Wild Die.

- **On a 7** it explodes: add it and roll again, repeating while it shows 7.
- **On a 1** it complicates.

This is not borrowed. `spec.md` §1 records both as already published — *"critical success = natural 7"* (`:44`) and *"a natural 1 complicates things about as often as a 7 saves them"* (`:49`). The Wild Die was in the post before D6 was proposed as the source.

**A critical is the first roll showing 7 — 14.29%, exactly the published figure.** Counting the whole exploding chain would give (1/7)/(1−1/7) = **16.67%** instead. First-roll-only is both the D6-faithful reading (D6 keys the critical on the designated Wild Die, not the pool) and the one that holds `:44` exactly.

## 4. Attributes and skills

This is D6's model with a seven-sided die. Nothing about it is invented here.

### Attributes

The five published in `spec.md` §2: **Strength, Agility, Intellect, Spirit, Luck.**

Each is a **dice code with pips**, written `3d7+2` — three dice plus two. `3 pips = 1D`, so `Xd7+3` is not a rating; it becomes `(X+1)d7`. That is D6's notation unchanged.

**Allocation: 15D across the five**, no attribute below `2d7` or above `4d7`. Star Wars D6 gives 18D across six attributes with a 2D–4D human range; 15D across five holds the same 3D average and the same range.

### Skills

**A skill starts at its governing attribute and rises above it in pips.** If Agility is `3d7+1`, every Agility skill is `3d7+1` until you spend on it; one pip in a skill makes it `3d7+2`.

**Allocation: 7D of skill dice at creation**, no more than `1D` (3 pips) in any single skill, except one chosen focus skill which may take up to `2D` (6 pips). Again, D6's numbers.

Skills are what you usually roll. The attribute is the floor.

### The published line this contradicts

`spec.md` §2 records attributes on a **1–7 scale** (`:53`), and that is simply not this system — D6 attributes are dice codes with pips, spanning `2d7`–`4d7` here, not integers 1 through 7. There is no conversion that makes both true.

**`:53` is wrong and needs amending.** Recording it plainly rather than working around it: an earlier draft of this file invented "attribute value is its dice count, 1–7" to satisfy that sentence, which dropped pips, invented a range with no basis in D6, and left skills unmentioned. The post already owes a correction for `:124`; this rides along with it.

The related clause at `:53-55` — the sheet "reads in the same units as the roll" — survives in a different and better way than the published one: a skill of `3d7+2` *is* the dice you pick up. The sheet is the roll.

⚠️ **UNSPECIFIED:** the skill list itself. D6 defines skills per attribute; geoLARP has published none.

## 5. Meta-currency

- **Character Point** — spend to add `+1d7` to a roll.
- **Fate Point** — spend to **double** the dice rolled.

Both port from D6 unchanged.

⚠️ **UNSPECIFIED:** how either is earned.

## 6. Licensing

The D6 System is **OGL v1.0** — West End Games released the 51000-series openly in August 2009, less Product Identity. Star Wars is Lucasfilm IP and is **not** open; only the system is.

**This repository is MIT** (`LICENSE`: "Copyright (c) 2025 Jonathan Pohlner and ScriptHammer contributors"), and `docs/FORKING.md` exists to encourage forks. OGL Section 15's attribution chain propagates to everyone downstream, so mixing it into an MIT fork-first template is a real cost, not a formality.

**Avoid it by construction.** Game mechanics are not copyrightable (17 U.S.C. §102(b)); specific expression is. Every number in §2 was recomputed from scratch for the d7 mean — none is D6's. Use your own band names and take no D6 text, and no OGL obligation attaches.

⚠️ **UNSPECIFIED:** whether the band names above ("Very Easy" … "Heroic") are distinctive enough to be D6 expression. They are generic difficulty adjectives, but renaming them costs nothing and removes the question.

## 7. What this does not decide

- The fiction. `spec.md` §8 question 1 is open, and the five encounter kinds remain "placeholders."
- Two players in one cell (`spec.md` §8 question 2). Note the roll is the **only** part of the loop that is not shared: encounters are seeded from place and date and are identical for everyone (`:74-77`), so two players in a cell face the same encounter and get different outcomes. Whether resolution should also be seeded from the cell is a real question this file does not answer.
- Damage, wounds, or any consequence track. D6 has one; nothing is published here.
- The export payload. `:100` binds the character to a file **or a QR code**; a `3d7+2`-style rating set is a wider payload than five integers, and QR density is a published commitment.

## 8. Verification

This system is implementable when:

- [ ] `1D = 3 pips` and `Xd7+3 → (X+1)d7` hold in the advancement code
- [ ] a skill defaults to its governing attribute and rises above it in pips
- [ ] 3d7 vs Moderate (13+) measures 44.6% ±1pt over 10,000 simulated rolls
- [ ] a first-roll 7 occurs at 14.29% ±0.5pt, matching `:44`
- [ ] a natural 1 complicates at the same rate, matching `:49`
- [ ] no D6 text appears in the repository — only recomputed numbers

**Nothing here is playtested.** `spec.md` §8 question 4 is the author's own: *"Whether it feels generous or chaotic is not something arithmetic can tell me."* Every number above is arithmetic.
