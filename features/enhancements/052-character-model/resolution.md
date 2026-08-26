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

**1D = 4 pips** is the recommendation, but this is a **choice, not a derivation** — see below. `Xd7+4` is not a rating; it becomes `(X+1)d7`.

> **The pip question, honestly.** A die adds its average; a pip adds exactly 1. So the value a die returns per pip it costs is:
>
> | | value per pip |
> |---|---|
> | D6, 3 pips | 3.5 / 3 = **1.167** |
> | d7 at 3 pips | 4.0 / 3 = **1.333** |
> | d7 at 4 pips | 4.0 / 4 = **1.000** |
>
> D6's 1.167 is deliberate: dice are better value than pips, which is what pushes advancement toward whole dice. Neither d7 option reproduces it — **3 pips exaggerates that bias, 4 pips removes it, and they are equidistant from D6 (0.167 either way).** Preserving D6's ratio exactly would need 3.43 pips, which is not a rating anyone can write.
>
> 4 is recommended because a finer pip makes advancement more granular and the arithmetic stays clean. 3 is equally defensible if you want D6's die-hunger. **Pick one and write it down; do not let the implementation decide.**

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

## 4. Attributes

The five published in `spec.md` §2: **Strength, Agility, Intellect, Spirit, Luck.**

**An attribute's value is its dice count.** Agility 4 means roll `4d7`. This is what reconciles the source system with the published commitment: `spec.md` §2 records attributes on a **1–7 scale** (`:53`), and 1–7 dice keeps that scale literal while giving D6 its pool.

**The published line this bends.** `:53-55` says the sheet "reads in the same units as the roll." Under a pool the sheet is in dice and the result is a sum, so the identity holds for the *scale* but not for the *total*. This is the one published sentence the conversion costs, and it is the softest of them — `:52`'s `2d7 keep highest` had already moved the crit rate to 26.53% without comment.

⚠️ **UNSPECIFIED:** starting allocation. D6's Star Wars gives 18D across six attributes; 15D across these five lands in the same place, but nothing is published and nothing here decides it.

⚠️ **UNSPECIFIED:** whether skills exist as a separate layer above attributes, as in D6.

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

- [ ] `1D = 4 pips` and `Xd7+4 → (X+1)d7` hold in the advancement code
- [ ] 3d7 vs Moderate (13+) measures 44.6% ±1pt over 10,000 simulated rolls
- [ ] a first-roll 7 occurs at 14.29% ±0.5pt, matching `:44`
- [ ] a natural 1 complicates at the same rate, matching `:49`
- [ ] no D6 text appears in the repository — only recomputed numbers

**Nothing here is playtested.** `spec.md` §8 question 4 is the author's own: *"Whether it feels generous or chaotic is not something arithmetic can tell me."* Every number above is arithmetic.
