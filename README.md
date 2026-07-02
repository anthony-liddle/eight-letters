# Peach of a Word

A word game built around the quiet pleasure of finding the long word. Set eight
letters into words, climb the tiers by score, and crown the puzzle by finding
the eight-letter source word the rack was built around, then read its definition
and etymology.

Two themes ship: a soft cute theme (the default) and a letterpress theme, where
the letters are metal type sorts and the source word is the word the type was
cut for. This is the v1 Remix: untimed, daily, completion-driven. Built as a
gift.

## Features

- **Daily and endless puzzles.** The daily is deterministic, a pure function of
  the local calendar date, identical on any reload. Endless deals a fresh
  puzzle on demand and never touches the streak.
- **Real dictionary validation.** Guesses are checked against a merged boundary
  of ENABLE and SCOWL size 95 plus a small curated patch layer (about 430k
  words), so common modern words like meme and email are accepted. Any valid
  word scores.
- **A points tier ladder, not a pass-or-fail gate.** Every valid word moves you
  up the named tiers, and rarer finds pay more, so progress is always earnable
  and never gated on an arbitrary subset. The tier names are skinned per theme.
- **A completion peak.** Above the tier ladder sits the true crown: finding
  every common word the rack can spell (measured against a curated SCOWL common
  pool). It is reachable and rare, never required for the day to feel done.
- **A rarity ladder for off-page finds.** A valid word beyond the common pool is
  graded Uncommon, Rare, or Mythic by how far past the common cutoff it sits, a
  discovery reward rather than a consolation prize. It never carries a
  denominator, so open-ended finding never becomes a grind.
- **A tappable glossary.** Every word you find is tappable for a short
  definition. Finding the eight-letter source word unlocks its full definition
  and etymology, the emotional center of the game.
- **Two themes.** Cute (the default) and letterpress, each with its own type,
  palette, marks, and tier names, swappable live with no flash on load.
- **Built to be played by anyone.** Full keyboard play, screen-reader
  announcements, visible focus, reduced-motion support, and color is never the
  only signal.
- **Prototype audio behind a clean interface,** muteable, ready for a real synth
  to drop in later.

## Getting started

```bash
pnpm install
pnpm dev          # start the dev server
```

The baked word data lives under `public/data` and is committed, so a fresh
clone runs without a build step. You only need the data pipeline below if you
are rebuilding that data.

## Data pipeline

The word data is baked offline in stages. The network-touching stages are
manual and run by hand; their outputs are committed so the build and CI stay
offline.

- `pnpm data:vendor` downloads the raw ENABLE list and SCOWL bands into
  `scripts/data-raw`. One time, rarely rerun.
- `pnpm defs:acquire` fetches a short Wiktionary gloss for every formable word
  into `scripts/data-raw/definitions.tsv`. Resumable and cached.
- `pnpm defs:rederive` recomputes the glosses from the existing cache with
  better sense selection (demoting language codes, abbreviations, and other
  junk first senses), offline and idempotent. Run it after acquisition to
  clean up short-word definitions.
- `pnpm data:build` reads those vendored files and bakes the static assets into
  `public/data`. It is offline except for source-word etymologies, which it
  still fetches from Wiktionary on a cache miss and caches under
  `scripts/.cache`.

## Scripts

- `pnpm dev` start the Vite dev server
- `pnpm build` type-check and build the static site
- `pnpm test` run the engine and persistence unit tests
- `pnpm lint` / `pnpm format` lint and format
- `pnpm data:build` rebuild the baked word data from the vendored lists
- `pnpm data:vendor` download the raw ENABLE and SCOWL lists (maintainer, one time)
- `pnpm defs:acquire` fetch Wiktionary glosses into the definitions TSV (maintainer)
- `pnpm defs:rederive` re-derive glosses from the cache with better sense selection (maintainer)
- `pnpm icons:build` regenerate the favicons, home-screen icons, and Open Graph image from source SVGs

## Metadata and icons

The theme-aware favicons, the PWA home-screen icons, and the 1200x630 Open Graph
image are generated from source SVGs by `scripts/build-icons.ts`. The favicons
swap by theme (a peach on cute, the source-word crown on letterpress); the
home-screen icons and the Open Graph image use the peach on the cute background,
with the home-screen icon composed to survive maskable cropping. They are
byproducts, not hand-exported binaries: rerun `pnpm icons:build` to rebuild
them.

Open Graph and canonical URLs must be absolute, so the site URL is configurable
via `VITE_SITE_URL` in `.env`, injected into `index.html` at build time. It
currently points at `https://peachofaword.com`; change that one line if the
production domain moves.

## Project structure

```
scripts/        build-time data pipeline (ENABLE, SCOWL, Wiktionary -> JSON)
scripts/data-raw/ vendored ENABLE, SCOWL, and definitions TSV, committed for offline builds
src/engine/     pure, framework-free, fully unit-tested game logic
src/data/       word-list loaders behind the engine's Dictionary interface
src/persistence/ local storage for streak and per-day progress
src/audio/      Web Audio synth behind an AudioEngine interface
src/ui/         thin React layer over the engine
public/data/    baked static assets the engine loads at runtime
```

The engine is pure and decoupled from React, the dictionary, and audio. Each of
those sits behind an interface so it can be swapped: a smaller word list, a real
Soundscape audio engine, or the timed Faithful Copy mode are all additive.

## Tech

React, Vite, TypeScript (strict), pnpm. Deployed on Vercel as a static site,
with privacy-light Vercel Analytics and no backend.

## Credits

Word data from ENABLE (public domain), SCOWL, and Wiktionary (CC BY-SA 4.0),
combined into the validation boundary with a small curated patch layer. See
[ATTRIBUTION.md](./ATTRIBUTION.md). Licensed MIT, see [LICENSE](./LICENSE).
