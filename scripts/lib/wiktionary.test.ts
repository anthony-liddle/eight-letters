import { describe, expect, it } from 'vitest';
import { firstSense, isJunkSense, selectSense } from './wiktionary.ts';

// Synthetic fixtures that mirror the real Wiktionary REST shapes seen in the
// disk cache. The cache is gitignored, so tests must not read it; these stand
// in for the shapes that drive the sense-selection bug. The usage-label spans
// are intentionally empty, matching what the cached JSON actually holds.

// car: a leading Symbol sense (the ISO 639 code) then the everyday Noun sense,
// whose first definition is empty (a stripped label) and whose second is the
// automobile. firstSense stops at the Symbol; selectSense should skip past it.
const carShape = JSON.stringify({
  en: [
    {
      partOfSpeech: 'Symbol',
      definitions: [
        {
          definition:
            '<span class="usage-label-sense"></span> ISO 639-2 &amp; ISO 639-3 language code for Kari’na.',
        },
      ],
    },
    {
      partOfSpeech: 'Noun',
      definitions: [
        { definition: '' },
        {
          definition:
            'A wheeled <a href="/wiki/vehicle">vehicle</a> that moves independently, powered mechanically, steered by a driver.',
        },
      ],
    },
  ],
});

// app: the same leading-Symbol shape, real sense is the software application.
const appShape = JSON.stringify({
  en: [
    {
      partOfSpeech: 'Symbol',
      definitions: [{ definition: 'ISO 639-3 language code for Apma.' }],
    },
    {
      partOfSpeech: 'Noun',
      definitions: [
        { definition: '' },
        {
          definition:
            'An <a href="/wiki/application">application</a>, especially a small downloadable program for a mobile device.',
        },
      ],
    },
  ],
});

// A word whose only sense is the technical ISO code (no everyday sense exists).
const onlyJunkShape = JSON.stringify({
  en: [
    {
      partOfSpeech: 'Symbol',
      definitions: [{ definition: 'ISO 639-3 language code for Saba.' }],
    },
  ],
});

// A word that was already correct: the first sense is the everyday meaning.
const alreadyCleanShape = JSON.stringify({
  en: [
    {
      partOfSpeech: 'Noun',
      definitions: [{ definition: 'A mammal of the family Canidae.' }],
    },
    {
      partOfSpeech: 'Symbol',
      definitions: [{ definition: 'ISO 639-3 language code for something.' }],
    },
  ],
});

// A genuine inflected form: "plural of aal" is the only and correct sense.
const formOfShape = JSON.stringify({
  en: [
    {
      partOfSpeech: 'Noun',
      definitions: [{ definition: 'plural of <a href="/wiki/aal">aal</a>' }],
    },
  ],
});

describe('isJunkSense', () => {
  it('demotes reliably-junk part-of-speech tags', () => {
    expect(isJunkSense('symbol', 'ISO 639-3 language code for Apma.')).toBe(
      true,
    );
    expect(isJunkSense('proper noun', 'A city in Texas.')).toBe(true);
    expect(isJunkSense('numeral', 'The number 5.')).toBe(true);
    expect(isJunkSense('letter', 'The first letter of the alphabet.')).toBe(
      true,
    );
  });

  it('demotes unmistakable junk openings regardless of pos', () => {
    expect(isJunkSense('noun', 'ISO 4217 currency code for the euro.')).toBe(
      true,
    );
    expect(isJunkSense('noun', 'Initialism of foo bar baz.')).toBe(true);
    expect(isJunkSense('noun', 'Abbreviation of something longer.')).toBe(true);
    expect(isJunkSense('noun', 'A male given name.')).toBe(true);
    expect(isJunkSense('noun', 'A surname from Old English.')).toBe(true);
    expect(isJunkSense('noun', 'A placename in Texas.')).toBe(true);
    expect(
      isJunkSense('noun', 'A taxonomic genus within the family Felidae.'),
    ).toBe(true);
  });

  it('keeps genuine everyday senses, including inflected forms', () => {
    expect(
      isJunkSense('noun', 'A wheeled vehicle that moves independently.'),
    ).toBe(false);
    expect(isJunkSense('noun', 'plural of aal')).toBe(false);
    expect(isJunkSense('verb', 'simple past and past participle of aah')).toBe(
      false,
    );
  });

  it('does not demote when a junk word appears mid-sentence', () => {
    // Conservative: the signal must be at the opening, not anywhere in the text.
    expect(
      isJunkSense('noun', 'The science of taxonomic classification.'),
    ).toBe(false);
    expect(
      isJunkSense('noun', 'A device that reads an ISO standard barcode.'),
    ).toBe(false);
  });
});

describe('selectSense', () => {
  it('skips a leading ISO-code Symbol sense and picks the everyday sense (car)', () => {
    const sense = selectSense(carShape);
    expect(sense).not.toBeNull();
    expect(sense?.text).toContain('vehicle');
    expect(sense?.text).not.toContain('ISO');
  });

  it('picks the software sense, not the ISO code (app)', () => {
    const sense = selectSense(appShape);
    expect(sense).not.toBeNull();
    expect(sense?.text).toContain('application');
    expect(sense?.text).not.toContain('ISO');
  });

  it('keeps the only technical sense rather than going blank (last resort)', () => {
    const sense = selectSense(onlyJunkShape);
    expect(sense).not.toBeNull();
    expect(sense?.text).toContain('ISO 639-3');
  });

  it('leaves an already-correct first sense unchanged', () => {
    const sense = selectSense(alreadyCleanShape);
    expect(sense?.text).toBe('A mammal of the family Canidae.');
  });

  it('keeps a genuine inflected-form sense', () => {
    const sense = selectSense(formOfShape);
    expect(sense?.text).toBe('plural of aal');
  });

  it('returns null when there is no usable sense', () => {
    expect(selectSense(null)).toBeNull();
    expect(selectSense('{"en":[]}')).toBeNull();
  });

  it('skips a "Terms relating to" grouping header within a sense (cat)', () => {
    // Wiktionary precedes the real noun with a topical grouping line. The real
    // definition lives in the same sense, so the sense must not be demoted
    // wholesale (that would jump to the Unix cat); the header alone is skipped.
    const catShape = JSON.stringify({
      en: [
        {
          partOfSpeech: 'Symbol',
          definitions: [{ definition: 'ISO 639-2 language code for Catalan.' }],
        },
        {
          partOfSpeech: 'Noun',
          definitions: [
            { definition: 'Terms relating to animals.' },
            { definition: 'A mammal of the family Felidae.' },
          ],
        },
        {
          partOfSpeech: 'Noun',
          definitions: [{ definition: 'A program and command in Unix.' }],
        },
      ],
    });
    expect(selectSense(catShape)?.text).toBe('A mammal of the family Felidae.');
  });
});

describe('firstSense keeps the first-sense policy (source-pool path)', () => {
  it('still returns the very first usable sense, junk or not', () => {
    // selectSense demotes junk; firstSense must not, so the source-pool path is
    // unchanged in output. (Verified end to end: data:build leaves
    // source-pool.json byte-identical.)
    expect(firstSense(carShape)?.text).toContain('ISO');
  });
});
