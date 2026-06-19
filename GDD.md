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
- Completion is word-count based: set words found over total set words. The progress bar and the tiers both run on this fraction, so the bar and the "X of Y" counter are always the same fact in two forms, and can never disagree. (An earlier draft weighted the bar by points, which made it read 98 percent at 12 of 13 words. Word-count fixes that.)
- Score is the separate meter. Every valid find adds points by length, per the curve above. Off-page finds climb the score, never the completion bar. The bar measures the goal, finishing the set; the score measures everything found.
- Off-page finds do not change the denominator. Their recognition is the rarity ladder (see the glossary), not a points multiplier in v1.

The score has a composition the bar does not: set points versus off-page points. The at-a-glance split of where points came from belongs to the score readout in the totals summary, not the completion bar, which stays a pure set-completion meter. That readout is specced separately.

This is what keeps the tiers feeling like Spelling Bee rather than impossible.

Tiers (Remix), by fraction of set words found:

- 0.00 Blank Page
- 0.08 A Few Words
- 0.22 Warming Up
- 0.40 In the Flow
- 0.60 Word Hoard
- 0.85 and source word found: Found the Word
- 1.00, every word in the set: Edition Complete (the crown)

The Found the Word rung needs both the high bar and the source word. That fuses her two signatures: always getting the long word, always going Queen Bee. Edition Complete is the true ceiling, every word in the common set found. Thresholds are tunable after playtest, but Edition Complete is always 100 percent of the set.

Edition Complete, the win state. When the set hits 100 percent (every common-pool word found), fire a one-time celebration. It does not end the game: input stays live and play continues for off-page finds. The progress bar fills fully with a finishing flourish, a printer's ornament or pressmark appears, and a one-time card slides in, a sibling to the source-word reveal but in ink and oxblood rather than amber, ornamental rather than a definition. A distinct, slightly grander sound, a step above the tier-up and source-word cues. No new color: completion is a typographic and ornamental event, not a sixth accent. That restraint is the letterpress register. Cute expresses the same moment in its own voice: a one-shot confetti burst of the cute motifs (peaches, hearts, stars, sparkles) with the dinosaur's hop, composed with the card and the grander sound as one beat. Both registers fire once per completed puzzle, and both respect reduced motion, where the motion is suppressed while the card and the quiet completed state remain. After the moment passes, the tier label holds a quiet Edition Complete state so the achievement stays visible while she keeps playing.

## The Glossary: The Set And The Rarity Ladder

Found words split on one axis: on the page, or off it. The set is the goal and stays clean and unbadged. Everything found beyond the set earns a rarity grade. Every mark is filled and positive. Nothing reads as a blank you failed to fill.

The set (the goal):

- In the set: a filled green square (heart in cute). One of the common-pool words the tiers count. The "X of Y" count tracks only these. The set carries no rarity label, because it is the thing you complete, not a rung on the ladder. Calling it "common" would make the goal read as the boring words, the opposite of how completion should feel, so the set is simply the set.

Off the page: the rarity ladder.

Any valid ENABLE word formable from the rack but outside the set is an off-page find, graded by how far past the common cutoff it sits. Three rungs, a hypothesis to confirm against real racks during tuning, collapsible to two if the bands clump:

- Uncommon: in SCOWL size 70 but not in the set. Familiar enough, just under the common cutoff. This is where a word like "ulna" lands. Not lesser, just off the page.
- Rare: in SCOWL size 95 but not in 70. The pleasant-surprise band.
- Mythic: valid in ENABLE but beyond size 95. The genuinely obscure tail, the word-nerd payoff for a linguist.

Marks and color:

- Every off-page find uses the discovery blue, with the rung encoded by shape, not color, so the ladder survives color-blind play and stays inside one-color-one-job. Letterpress escalates marks (for example dagger, diamond, then a pressmark). Cute escalates glyphs (star, sparkle, then a gem). Points are always shown inline, because the points are the reward.
- Rung names are vocabulary, skinnable per theme like the marks. Cute leans into the loot-ladder register: Uncommon, Rare, Mythic. Letterpress may want a quieter typographic skin for the same three rungs. That wording is an open voice question, not a structural one.

No denominator, ever:

- The set carries an "X of Y" because it is meant to be finished. The rarity ladder never does. Counts per rung can appear in the totals summary ("Uncommon 4, Rare 2, Mythic 1"), but never "2 of 47 Rare." Advertising how many off-page words exist would turn open-ended discovery into a grind, the exact thing the set split prevents.

Source word: its own crown mark and legend entry, in amber (peach in cute). The peak, above the whole ladder.

Celebration hierarchy (the safeguard):

- The ladder stays seasoning, never the main course. The two peaks are the source word and Edition Complete. Those are the loud moments and they own the confetti. A rarity find is a small, pleasant chime that may grow a little by rung, with Mythic earning a touch more sparkle in cute, but it never rivals the crown or the completion moment. If a Rare find ever feels bigger than finishing the set, the celebration has inverted and needs pulling back, not the model.

## Word List, Validation, And Pipeline

Two public-domain lists, both baked in. No per-guess network call.

- Validation: ENABLE (Enhanced North American Benchmark LExicon). About 170k words, public domain, the standard for hobby word games. A guess is valid if it is 3 letters or more, formable from the 8 letters, and in ENABLE.
- Source-word pool: SCOWL small (size 35 to 50) filtered to length 8, then hand-reviewed to drop anything Bea would not recognize as the answer. Keep it modest, a few hundred recognizable words. Small enough to review by hand and to carry etymology for.
- Common pool (the tier denominator): SCOWL small filtered to the day's letters, length 3 and up.
- Rarity bands (off-page finds): graded by SCOWL membership. Uncommon is in size 70 but not in the set, Rare is in size 95 but not in 70, Mythic is valid in ENABLE but beyond size 95. Three rungs as a hypothesis, validated against real-rack distribution during tuning.

Plurals and inflections are accepted, since they are valid ENABLE words. Proper nouns and slurs are out (ENABLE already excludes them). Minimum word length is 3, honoring the original.

Acquisition versus build. These are two different things, and only one of them ever touches the network.

The raw lists are vendored. ENABLE and classic SCOWL v1 are frozen public-domain artifacts (ENABLE2K has not changed since 2000), so the raw lists are committed into the repo as pinned static files. The build reads them locally and never fetches them.

The Wiktionary definitions are a one-time bake, not a build step. A separate acquisition script gathers definitions once, politely (reusing the existing cached, rate-limited per-word Wiktionary REST path, with a descriptive User-Agent and CC BY-SA attribution; a bulk machine-readable extract is the documented swap-in if a re-acquisition ever needs to go wider or faster), and writes the result to a committed file. Normal builds read that committed file. The acquisition reruns only when deliberately chosen, never automatically. Touching the network is a manual "refresh the data" action, not part of the build.

The build is therefore fully offline and reproducible: it reads committed raw lists and a committed definitions file, and emits the runtime assets.

Build steps (offline, reads committed files):

1. Produce the ENABLE validation set as a compact structure (a Set, or a length-bucketed index for fast formability checks).
2. Derive the source-word pool from the committed SCOWL small list, length 8, hand-reviewed.
3. Read the committed definitions and the source-word etymology. Source words keep their full definition and etymology for the reveal. Every other word formable across the daily racks carries a short definition for tappable lookups.
4. Emit the runtime assets: ENABLE, the common-pool source (SCOWL small), the rarity bands as complements (a beyond-size-70 set and a beyond-size-95 set, not the full positive lists), the source-pool-with-etymology JSON, and the definitions assets. Classification runs by precedence (set, then size 70, then size 95, then the remainder), so the complements grade every word identically while shipping far less data. (ulna is in ENABLE and in neither beyond-band, so it resolves to Uncommon.) The SCOWL bands come from classic SCOWL (v1), not its successor ESDB, which dropped the size 95 level the Mythic rung depends on. The shipped band files are baked from v1, so the upstream rename does not affect the running game. If the bands are ever regenerated, regenerate from classic SCOWL v1, not ESDB, or the Mythic boundary moves.

Storage formats. Raw source data and runtime assets are separate and do not have to match.

- Word lists stay .txt, one word per line. Transparent, diffable, the format the lists ship in, fast to parse into a Set. A packed structure (a DAWG or trie) would be smaller but opaque and non-diffable, real complexity for no benefit at this scale, so skip it.
- Source-word etymology stays JSON, since it is a few hundred rich, multi-field records.
- The definitions map is flat TSV, one word and short definition per line, tab-separated. Compact, diffs line by line, trivial to append, which lets it share a home with the future dictionary patch layer.

Loading strategy. Do not load the whole definitions map on page open. Load only what a rack needs. The scheme is per-puzzle bundles, one small file per rack, lazy-loaded from our own static assets when a puzzle starts, since every rack's formable words are known at build time. The first bake settled this against the first-letter shard alternative on measured numbers. A session loads one bundle, at most about 8 KB gzipped for the heaviest rack (ancestor), where first-letter shards would pull every letter that rack can start a word with, about 141 KB gzipped for the same rack. The bundles' combined footprint is larger (about 1.6 MB gzipped across 707 racks versus about 287 KB for 26 shards), but nothing loads the whole set, so per-session load is the metric that matters and per-puzzle wins it decisively. These are same-origin static fetches, not external calls, so the offline stance holds.

Measured after the bake and a recovery pass: the formable union is 16,285 words across 707 racks, and 15,824 carry a definition (about 97 percent). Set words are at 100 percent and source words at 707 of 707, the two figures that matter most. The first bulk run came in at 80 percent, but that was throttling loss, not real absence: coverage was flat across rarity bands and common words like audience and password were missing, both signs of dropped fetches rather than missing entries. A single polite re-run with backoff and Retry-After honoring recovered 2,767 of them. The remaining 461 are the honest absence floor, concentrated in the rare band, words with no usable Wiktionary entry. They resolve to a graceful no-definition state, and the definitions TSV is appendable, so glosses can be filled in later. The short-gloss cap is 140 characters, which trims about 5 percent of glosses at a word boundary.

## Daily And Endless

- Daily: one puzzle per calendar day, identical on any device. Deterministic, no backend. Rollover at local midnight (a one-person audience, so simpler than NYT's fixed Eastern time).
- The day index seeds a deterministic shuffle of the source pool, so the sequence never repeats until the pool is exhausted. Pick an epoch date for day one.
- Endless: a fresh puzzle on demand, from the New Puzzle button. Does not touch the streak.
- State retention: Daily and Endless each keep their own in-progress game, persisted independently. Switching modes is a view change and never resets either one. The only way to abandon the current Endless puzzle is the New Puzzle button. A reload preserves both, since nothing but New Puzzle clears Endless.
- Streak: consecutive daily puzzles cleared to a chosen tier. Local only in v1, sync in v2.

## Personalization

Where a copy becomes a gift only you would make.

- Etymology and definition reveal on finding the source word. She is a linguist, and the prototype confirmed this is the standout moment.
- Streaks, quiet and never naggy.
- Optional shareable result, spoiler-free, in the NYT mold. Private, or shared between the two of you.

## Aesthetics And Audio

- Lo-fi, quiet, typographic. Letterpress signature: the eight letters are type sorts you set into words, and the source word is the word the type was cut for. Carried over from the prototype.
- Audio for v1: prototype-level synth, behind a clean interface so real Soundscape drops in later. Do not port Soundscape yet. A distinct cue for the source word, a gentle tier-up, a sound toggle, reduced motion and mute from the start.

## Palette

One color, one job. Nothing does two.

- Paper `#F1EEE6`: the background.
- Ink `#211D17`: primary text and the type sorts.
- Oxblood `#9D2B25`: brand and chrome only. The masthead, the rubricated "Word," the flourishes, the active mode toggle. Rubrication is the historically correct letterpress second color.
- Green `#4B6A52`: status only. The "in the set" marker in the glossary, the signal that a found word counts toward the common pool.
- Amber `#B5872F`: the source-word crown, and nothing else. The reveal card, the crowned glossary chip, the found-source state. Reserved so the emotional peak reads as special.
- Discovery `#3E5C7E`: off-page finds, the whole rarity ladder. A cool ink-blue, like fountain-pen marginalia, distinct from the warm status, chrome, and crown tones. One blue for every rung; the rung is encoded by mark shape, not by color.
- Secondary ink: a muted ink for secondary text, darkened to meet WCAG AA against paper. Quiet but legible.

## Themes

The game ships with a theme toggle. Two themes to start, with an architecture that makes more cheap.

- Letterpress (default): the current look. Paper, ink, oxblood, sage, amber, Fraunces. Marks: square for in the set, escalating discovery-blue marks for the off-page rarity rungs (for example dagger, diamond, pressmark), crown for the source word.
- Cute: a soft kawaii skin over the same layout. Peach-cream background, candy pink and peach accents, cocoa text, rounded bubble letters (Fredoka) with a rounded body face (Nunito), squishy tiles. Motifs: peaches and a tiny silly dinosaur, plus general kawaii softness. Hello Kitty is the register, not a literal character (it is trademarked), so the motifs are original. Marks: heart for in the set, escalating glyphs for the off-page rarity rungs (for example star, sparkle, gem), peach for the source word.
- Architecture: a data-theme attribute on the root, every color and font as a CSS variable per theme, marks swapped per theme. The choice persists in local storage and loads via an inline head script before paint, so there is no flash of the wrong theme.

## Accessibility

First-class, not a checklist.

- Full keyboard play. Well-sized tap targets.
- Screen reader announces found words with their rarity rung, score changes, tier changes, and the source-word moment.
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
- Tier thresholds, now read as fractions of set words found.
- Common-pool size (SCOWL 35 versus 50) for the right completion difficulty.
- Daily epoch date.
- Rarity ladder rung count: confirm three rungs against the real distribution of off-page finds on typical racks, or collapse to two if the SCOWL bands clump.
- Whether rarity adds points or is recognition only. Default to recognition, so off-page hunting never competes with completing the set. Revisit only if play feels flat.
- Letterpress rung vocabulary: the quiet typographic skin for Uncommon, Rare, and Mythic. A voice question, not a structural one.
