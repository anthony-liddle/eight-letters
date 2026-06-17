# 8 Letters in Search of a Word: Game Design Document

Status: v1 spec. Ready to build. Living document.

Origin and audience: see [[8 Letters in Search of a Word/Overview|Overview]] for the why and the who. This doc is the what and the how.

## Overview And Goals

A word game built from Bea's favorite Flash game. Two versions share one engine:

- Remix. The version shaped around how she actually plays. Untimed, daily, completion-driven, source word as the crown. This is v1.
- Faithful Copy. The game she remembers. Timed, level-based. A thin fast-follow on the same engine.

Design goals:

- The copy is exact enough to feel like the thing she loved.
- The remix slots into her existing NYT games ritual.
- The source word is the emotional center, not a footnote.
- Lo-fi, quiet, no dark patterns. A gift, not a product.

## v1 Scope And Cut Line

In v1:

- The shared game engine.
- Remix mode only: daily plus endless, real dictionary, completion tiers, the source-word etymology reveal, prototype-level audio.

Fast-follow (v1.1):

- Faithful Copy mode. The same engine plus a 60-second clock and a pass-or-fail goal gate. A small surface, not a separate build.

Later (v2):

- Cross-device streak sync (needs a backend). Real Soundscape audio. Mobile, by Expo plus react-native-web or a PWA wrap, decided once the web build proves out.

## The Two Versions

### Remix (v1)

- 8 scrambled letters from a daily or endless source word.
- Make words of 3 letters or more.
- No timer.
- Completion tiers, not a pass-or-fail gate.
- Source word promoted to headline: a big moment, names the puzzle, unlocks the etymology reveal, gates the top tier.
- Streaks on the daily. Optional shareable result.

### Faithful Copy (v1.1)

- Same letter set and word-making core.
- 60-second timer.
- Clear a goal score to advance a level. Below the goal at zero, the game ends.
- Bonus for the source word.
- Do not modernize this. Fidelity is the point.

## Core Loop

1. Receive 8 scrambled letters.
2. Form a word (type or tap).
3. Valid and new: score it, add it to the found list, play feedback.
4. Repeat, tracking progress toward the next tier.
5. Find the source word: the headline event, with the etymology reveal.
6. End state. Remix: stop when satisfied, or when the common set is exhausted. Copy: time runs out.

Input supports typing and tapping. Always offer shuffle and clear.

## Scoring And Tiers

Scoring (draft, tune after first playtest):

- 3 letters: 1
- 4 letters: 3
- 5 letters: 5
- 6 letters: 7
- 7 letters: 11
- 8 letters (source word): 15

Two pools, and one important split:

- Validation pool: full ENABLE filtered to the day's letters. Any word in it scores, so Bea is never wrongly rejected.
- Common pool: a smaller set (SCOWL small, around size 50) filtered to the letters. This is the denominator.

Tiers and the found count are computed against the common pool, not full ENABLE. A rich rack can hold well over a hundred ENABLE words, which would make completion brutal and crush the tier percentages into nonsense. So:

- "X of Y words set" counts the common pool.
- Tier percentage is player points from common-pool words over the common-pool total.
- ENABLE-only finds (valid but not common) still score, as bonus points on top. They do not change the denominator.

This is what keeps the tiers feeling like Spelling Bee rather than impossible.

Tiers (Remix), by percentage of the common-pool total:

- 0.00 Blank Page
- 0.08 A Few Words
- 0.22 Warming Up
- 0.40 In the Flow
- 0.60 Word Hoard
- 0.85 and source word found: Found the Word (top)

The top rung needs both the high bar and the source word. That fuses her two signatures: always getting the long word, always going Queen Bee. Thresholds are tunable after playtest.

## Word List, Validation, And Pipeline

Two public-domain lists, both baked in. No per-guess network call.

- Validation: ENABLE (Enhanced North American Benchmark LExicon). About 170k words, public domain, the standard for hobby word games. A guess is valid if it is 3 letters or more, formable from the 8 letters, and in ENABLE.
- Source-word pool: SCOWL small (size 35 to 50) filtered to length 8, then hand-reviewed to drop anything Bea would not recognize as the answer. Keep it modest, a few hundred recognizable words. Small enough to review by hand and to carry etymology for.
- Common pool (the tier denominator): SCOWL small filtered to the day's letters, length 3 and up.

Plurals and inflections are accepted, since they are valid ENABLE words. Proper nouns and slurs are out (ENABLE already excludes them). Minimum word length is 3, honoring the original.

Build-time pipeline (a script, not runtime):

1. Produce the ENABLE validation set as a compact structure (a Set, or a length-bucketed index for fast formability checks).
2. Derive the source-word pool from SCOWL small, length 8, hand-reviewed.
3. For each source word, pull a definition and short etymology from Wiktionary. Wiktionary is CC BY-SA, so the build must carry attribution. Bake the result to JSON.
4. Ship ENABLE, the common-pool source (SCOWL small), and the source-pool-with-etymology JSON as static assets.

## Daily And Endless

- Daily: one puzzle per calendar day, identical on any device. Deterministic, no backend. Rollover at local midnight (a one-person audience, so simpler than NYT's fixed Eastern time).
- The day index seeds a deterministic shuffle of the source pool, so the sequence never repeats until the pool is exhausted. Pick an epoch date for day one.
- Endless: a fresh puzzle on demand. Does not touch the streak.
- Streak: consecutive daily puzzles cleared to a chosen tier. Local only in v1, sync in v2.

## Personalization

Where a copy becomes a gift only you would make.

- Etymology and definition reveal on finding the source word. She is a linguist, and the prototype confirmed this is the standout moment.
- Streaks, quiet and never naggy.
- Optional shareable result, spoiler-free, in the NYT mold. Private, or shared between the two of you.

## Aesthetics And Audio

- Lo-fi, quiet, typographic. Letterpress signature: the eight letters are type sorts you set into words, and the source word is the word the type was cut for. Carried over from the prototype.
- Audio for v1: prototype-level synth, behind a clean interface so real Soundscape drops in later. Do not port Soundscape yet. A distinct cue for the source word, a gentle tier-up, a sound toggle, reduced motion and mute from the start.

## Accessibility

First-class, not a checklist.

- Full keyboard play. Well-sized tap targets.
- Screen reader announces found words, score changes, tier changes, and the source-word moment.
- Dynamic Type and reflow. A dyslexia-friendly font option is worth considering.
- Color is never the only signal.

## Tech Notes (Stack And Platform)

Stack: React, Vite, TypeScript, pnpm. Its own standalone repo, not the monorepo, to stay light and giftable. React over Astro because this is an app, not content, and because a later React Native port is far easier from React than from Astro.

Platform: web first. Build the web version, confirm it stays fun at full-dictionary scale, then bring it to mobile. Not mobile-only.

Mobile, when it comes, is one of two paths, decided later:

- Expo plus react-native-web: one codebase to iOS, Android, and web, the App Store option, one native audio dependency (react-native-audio-api, from the Reanimated team).
- Pure web wrapped as a PWA: lightest, zero new dependencies, Soundscape runs as-is.

Audio is the hinge of that later choice: zero-dependency web where Soundscape just works, or one trusted native dependency to reach the App Store.

Backend: none in v1. The daily puzzle is a pure function of the date plus the baked word lists. Streaks and progress in local storage. Cross-device sync is the only thing that would need a server, and that is v2.

## Confirmed Defaults

- Minimum word length: 3.
- Plurals and inflections: accepted (valid ENABLE words).
- Scoring curve: the draft above, tuned after the first real-dictionary playtest.

## Tuning After First Playtest

Not open design questions, just numbers to feel out once it runs against real lists:

- Scoring curve values.
- Tier thresholds.
- Common-pool size (SCOWL 35 versus 50) for the right completion difficulty.
- Daily epoch date.
