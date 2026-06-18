import { describe, expect, it } from 'vitest';
import {
  mergeDefinitions,
  parseDefinitions,
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
