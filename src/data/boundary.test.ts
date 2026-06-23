import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyWord, createPuzzle, validateGuess } from '@/engine/index.ts';
import { createListDictionary, createListWordSource } from './listSource.ts';
import { applyPatch, parsePatch, type PatchableLists } from './patch.ts';

// Build the live merged lists from the committed assets, exactly as
// loadGameData does, but read from disk instead of fetched. This exercises the
// real ENABLE union SCOWL 95 boundary with the patch on top.
function readList(name: string): string[] {
  return readFileSync(`public/data/${name}`, 'utf8')
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean);
}

const patch = parsePatch(
  readFileSync('public/data/dictionary-patch.tsv', 'utf8'),
);
const merged: PatchableLists = applyPatch(
  {
    enable: [...readList('enable.txt'), ...readList('scowl95-additions.txt')],
    common: readList('common-pool.txt'),
    beyond70: readList('beyond-size-70.txt'),
    beyond95: readList('beyond-size-95.txt'),
  },
  patch,
);
const validation = new Set(merged.enable);

function puzzleFor(rack: string) {
  return createPuzzle(
    rack,
    createListDictionary(merged.enable),
    createListWordSource(merged.common),
    createListWordSource(merged.beyond70),
    createListWordSource(merged.beyond95),
  );
}

describe('ENABLE union SCOWL 95 boundary (live assets)', () => {
  it('validates the modern and everyday must-accept probe at 100 percent', () => {
    const probe = [
      // modern words ENABLE lacked
      'meme',
      'email',
      'blog',
      'selfie',
      'emoji',
      'podcast',
      'website',
      'online',
      'internet',
      'hashtag',
      'spam',
      'login',
      'logout',
      'screenshot',
      'metadata',
      'texting',
      'googled',
      'smartphone',
      'unfriend',
      'webpage',
      // the beyond-95 moderns the allowlist carries
      'app',
      'wifi',
      'upvote',
      'downvote',
      'chatbot',
      'cyber',
      'udon',
      // everyday words a strong player expects
      'coffee',
      'garden',
      'window',
      'pencil',
      'yellow',
      'kitten',
      'pizza',
      'guitar',
      'rocket',
      'monster',
      'blanket',
      'sandwich',
    ];
    const missing = probe.filter((w) => !validation.has(w));
    expect(missing).toEqual([]);
  });

  it('bands every beyond-95 modern so it never lands in the mythic tail', () => {
    // app, wifi, upvote, downvote, chatbot, cyber sit beyond SCOWL 95. They are
    // allowlisted common, so they join the common pool and grade as set words.
    const commonSet = new Set(merged.common);
    const beyond95Set = new Set(merged.beyond95);
    for (const word of [
      'app',
      'wifi',
      'upvote',
      'downvote',
      'chatbot',
      'cyber',
    ]) {
      expect(commonSet.has(word)).toBe(true);
      expect(beyond95Set.has(word)).toBe(false);
    }
  });

  it('grades a word newly admitted by SCOWL as uncommon or rare, never mythic', () => {
    // babysit is a SCOWL word ENABLE rejected; use it as its own rack.
    expect(validation.has('babysit')).toBe(true);
    const puzzle = puzzleFor('babysit');
    expect(validateGuess('babysit', puzzle, new Set()).kind).toBe('valid');
    const rung = classifyWord('babysit', puzzle);
    expect(['uncommon', 'rare']).toContain(rung);
    expect(puzzle.mythicWords.has('babysit')).toBe(false);
  });

  it('rejects denylisted warts that SCOWL would otherwise admit', () => {
    // bonjour and cairo both entered the boundary via the SCOWL additions, then
    // the denylist removes them. bonjour is the curated foreign word; cairo is a
    // formable proper-noun wart.
    const additions = new Set(readList('scowl95-additions.txt'));
    expect(additions.has('bonjour')).toBe(true);
    expect(additions.has('cairo')).toBe(true);
    // After the patch they are gone from validation.
    expect(validation.has('bonjour')).toBe(false);
    expect(validation.has('cairo')).toBe(false);
    // And a rack that can spell cairo rejects it rather than counting it.
    const puzzle = puzzleFor('cairouln');
    expect(validateGuess('cairo', puzzle, new Set()).kind).toBe('not-a-word');
  });

  it('keeps the mythic tail base unchanged: beyond-95 stays ENABLE minus SCOWL 95', () => {
    // Every addition is within SCOWL 95, so none reach beyond-95. The tail is
    // exactly the ENABLE words beyond 95 it always was.
    const additions = new Set(readList('scowl95-additions.txt'));
    const beyond95 = readList('beyond-size-95.txt');
    expect(beyond95.some((w) => additions.has(w))).toBe(false);
    expect(beyond95.length).toBe(5399);
  });
});
