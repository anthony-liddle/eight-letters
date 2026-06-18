# Vendored word list provenance

These raw lists are committed so the build is fully offline and reproducible.
ENABLE2K and SCOWL v1 are frozen, so reading these local files is safe forever.
Refresh them only by re-running: pnpm data:vendor

## ENABLE

- Source: https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
- License: public domain.
- Vendored: 2026-06-18.

## SCOWL

- Source: https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz
- Version: 2020.12.07.
- License: permissive (Kevin Atkinson). See ATTRIBUTION.md.
- Vendored bands: english, american at sizes 10, 20, 35, 40, 50, 55, 60, 70, 80, 95.
- Vendored: 2026-06-18.

## Wiktionary (definitions and etymology)

- Definitions in definitions.tsv and source-pool etymology come from Wiktionary.
- License: CC BY-SA 4.0. Attribution carried here and surfaced in the colophon.
