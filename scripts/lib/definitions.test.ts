import { describe, expect, it } from 'vitest';
import {
  mergeDefinitions,
  parseDefinitions,
  rederiveGlosses,
  serializeDefinitions,
  shapeDefinition,
} from './definitions.ts';

const multiSense = JSON.stringify({
  en: [
    {
      partOfSpeech: 'Noun',
      definitions: [
        { definition: 'A <b>domesticated</b> carnivorous mammal.' },
        { definition: 'A second, unwanted sense.' },
      ],
    },
    { partOfSpeech: 'Verb', definitions: [{ definition: 'to prowl.' }] },
  ],
});

describe('shapeDefinition', () => {
  it('reduces a multi-sense entry to one short plain gloss, markup stripped', () => {
    expect(shapeDefinition(multiSense, 140)).toBe(
      'noun. A domesticated carnivorous mammal.',
    );
  });

  it('truncates a long gloss at a word boundary within the cap', () => {
    const long = JSON.stringify({
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [{ definition: 'word '.repeat(60) }],
        },
      ],
    });
    const out = shapeDefinition(long, 40);
    expect(out).not.toBeNull();
    expect((out as string).length).toBeLessThanOrEqual(40);
    expect(out as string).not.toMatch(/wor$/); // no half words
  });

  it('does not cut at the part-of-speech period', () => {
    const json = JSON.stringify({
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [
            { definition: 'A full sentence without early termination.' },
          ],
        },
      ],
    });
    expect(shapeDefinition(json, 140)).toBe(
      'noun. A full sentence without early termination.',
    );
  });

  it('returns null when there is no usable sense', () => {
    expect(shapeDefinition(null, 140)).toBeNull();
    expect(shapeDefinition('{"en":[]}', 140)).toBeNull();
  });

  it('skips a leading junk sense and shapes the everyday one (car)', () => {
    const car = JSON.stringify({
      en: [
        {
          partOfSpeech: 'Symbol',
          definitions: [
            {
              definition:
                'ISO 639-2 &amp; ISO 639-3 language code for Kari’na.',
            },
          ],
        },
        {
          partOfSpeech: 'Noun',
          definitions: [
            { definition: '' },
            { definition: 'A wheeled vehicle that moves independently.' },
          ],
        },
      ],
    });
    const gloss = shapeDefinition(car, 140);
    expect(gloss).toContain('vehicle');
    expect(gloss).not.toContain('ISO');
    expect(gloss?.startsWith('noun. ')).toBe(true);
  });

  it('picks the software sense for app, not the ISO code', () => {
    const app = JSON.stringify({
      en: [
        {
          partOfSpeech: 'Symbol',
          definitions: [{ definition: 'ISO 639-3 language code for Apma.' }],
        },
        {
          partOfSpeech: 'Noun',
          definitions: [
            {
              definition:
                'An application, especially a small downloadable program for a mobile device.',
            },
          ],
        },
      ],
    });
    const gloss = shapeDefinition(app, 140);
    expect(gloss).toContain('application');
    expect(gloss).not.toContain('ISO');
  });

  it('keeps a word whose only sense is technical (last resort)', () => {
    const onlyJunk = JSON.stringify({
      en: [
        {
          partOfSpeech: 'Symbol',
          definitions: [{ definition: 'ISO 639-3 language code for Saba.' }],
        },
      ],
    });
    expect(shapeDefinition(onlyJunk, 140)).toBe(
      'symbol. ISO 639-3 language code for Saba.',
    );
  });
});

describe('TSV round-trip', () => {
  it('writes sorted lines and reads back the same map', () => {
    const map = new Map([
      ['zebra', 'a striped equine'],
      ['ace', 'a single pip card'],
    ]);
    const tsv = serializeDefinitions(map);
    expect(tsv).toBe('ace\ta single pip card\nzebra\ta striped equine\n');
    expect(parseDefinitions(tsv)).toEqual(map);
  });

  it('merges new entries, dedupes, and stays sorted', () => {
    const existing = parseDefinitions('ace\tone\nbead\ttwo\n');
    const incoming = parseDefinitions('bead\tupdated\ncab\tthree\n');
    const merged = serializeDefinitions(mergeDefinitions(existing, incoming));
    expect(merged).toBe('ace\tone\nbead\tupdated\ncab\tthree\n');
  });
});

describe('rederiveGlosses', () => {
  const carJunk = JSON.stringify({
    en: [
      {
        partOfSpeech: 'Symbol',
        definitions: [{ definition: 'ISO 639-2 language code for Kari’na.' }],
      },
      {
        partOfSpeech: 'Noun',
        definitions: [
          { definition: 'A wheeled vehicle that moves independently.' },
        ],
      },
    ],
  });

  it('replaces a junk gloss with the better sense from cache', () => {
    const existing = parseDefinitions(
      'car\tsymbol. ISO 639-2 language code for Kari’na.\n',
    );
    const result = rederiveGlosses(existing, () => carJunk, 140);
    expect(result.next.get('car')).toBe(
      'noun. A wheeled vehicle that moves independently.',
    );
    expect(result.changed).toEqual([
      {
        word: 'car',
        before: 'symbol. ISO 639-2 language code for Kari’na.',
        after: 'noun. A wheeled vehicle that moves independently.',
      },
    ]);
    expect(result.cacheMisses).toEqual([]);
  });

  it('keeps the existing gloss when the cache is missing (no network, no blank)', () => {
    const existing = parseDefinitions('zzz\tnoun. a kept gloss\n');
    const result = rederiveGlosses(existing, () => null, 140);
    expect(result.next.get('zzz')).toBe('noun. a kept gloss');
    expect(result.changed).toEqual([]);
    expect(result.cacheMisses).toEqual(['zzz']);
  });

  it('leaves an unchanged gloss out of the changed list', () => {
    const cleanJson = JSON.stringify({
      en: [
        {
          partOfSpeech: 'Noun',
          definitions: [{ definition: 'A mammal of the family Canidae.' }],
        },
      ],
    });
    const existing = parseDefinitions(
      'dog\tnoun. A mammal of the family Canidae.\n',
    );
    const result = rederiveGlosses(existing, () => cleanJson, 140);
    expect(result.next.get('dog')).toBe(
      'noun. A mammal of the family Canidae.',
    );
    expect(result.changed).toEqual([]);
  });

  it('keeps the prior gloss when the cache yields no usable sense', () => {
    const existing = parseDefinitions('xyz\tnoun. prior gloss\n');
    const result = rederiveGlosses(existing, () => '{"en":[]}', 140);
    expect(result.next.get('xyz')).toBe('noun. prior gloss');
    expect(result.changed).toEqual([]);
    expect(result.cacheMisses).toEqual([]);
  });
});
