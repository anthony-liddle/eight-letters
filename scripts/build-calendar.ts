/**
 * Build the frozen daily calendar. Runs offline against the already-baked data.
 *
 *   pnpm data:calendar
 *
 * Outputs public/data/daily-calendar.json: { epoch, words }, the ordered daily
 * sequence. Eligibility (set size at least MIN_SET_SIZE, crown-inclusive) is
 * computed through the engine's createPuzzle, reused via eligibleSourceWords,
 * never reimplemented.
 *
 * APPEND-ONLY INVARIANT (load-bearing, do not break):
 *   The daily calendar is append-only. Never reorder it, never remove from it.
 *   New words go on the end. The generator enforces this: existing entries keep
 *   their position and order, and any newly eligible word is appended to the
 *   end. Removing or reordering an entry re-dates every day after it and breaks
 *   the promise that a given day is a fixed puzzle.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eligibleSourceWords } from '../src/engine/eligibility.ts';
import { generateCalendar } from '../src/engine/calendar.ts';
import { DAILY_EPOCH } from '../src/engine/config.ts';
import { formableFrom } from '../src/engine/formability.ts';
import type { Dictionary, WordSource } from '../src/engine/types.ts';
import type { SourceEntry } from '../src/data/types.ts';
import { writeAsset } from './lib/util.ts';

// List-backed sources, identical to src/data/listSource.ts but imported via a
// relative path so the build script avoids the app's @/ alias under tsx.
function listDictionary(words: Iterable<string>): Dictionary {
  const set = new Set(words);
  return { has: (w) => set.has(w), formableWords: (r) => formableFrom(r, set) };
}
function listWordSource(words: Iterable<string>): WordSource {
  const list = [...words];
  return { formableWords: (r) => formableFrom(r, list) };
}

const DATA = join(import.meta.dirname, '..', 'public', 'data');

async function wordList(file: string): Promise<string[]> {
  const raw = await readFile(join(DATA, file), 'utf8');
  return raw
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean);
}

interface CalendarFile {
  epoch: typeof DAILY_EPOCH;
  words: string[];
}

async function loadExistingCalendar(): Promise<string[]> {
  try {
    const raw = await readFile(join(DATA, 'daily-calendar.json'), 'utf8');
    return (JSON.parse(raw) as CalendarFile).words ?? [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  console.log('Building the daily calendar.\n');

  const [enable, common, beyond70, beyond95, sourceJson] = await Promise.all([
    wordList('enable.txt'),
    wordList('common-pool.txt'),
    wordList('beyond-size-70.txt'),
    wordList('beyond-size-95.txt'),
    readFile(join(DATA, 'source-pool.json'), 'utf8'),
  ]);

  const dictionary = listDictionary(enable);
  const commonPool = listWordSource(common);
  const beyond70Pool = listWordSource(beyond70);
  const beyond95Pool = listWordSource(beyond95);

  const sourceWords = (JSON.parse(sourceJson) as SourceEntry[]).map(
    (e) => e.word,
  );
  const eligible = eligibleSourceWords(
    sourceWords,
    dictionary,
    commonPool,
    beyond70Pool,
    beyond95Pool,
  );
  console.log(
    `  ${eligible.length} of ${sourceWords.length} source words clear the floor ` +
      `(${sourceWords.length - eligible.length} sub-floor, kept as found words but never headlining).`,
  );

  const existing = await loadExistingCalendar();
  const words = generateCalendar(eligible, existing);
  const appended = words.length - existing.length;
  console.log(
    existing.length === 0
      ? `  First run: established ${words.length} days in a seeded shuffle.`
      : `  Append-only: kept ${existing.length} days, appended ${appended} new.`,
  );

  const calendar: CalendarFile = { epoch: DAILY_EPOCH, words };
  await writeAsset('daily-calendar.json', JSON.stringify(calendar));
  console.log('\nDone. Wrote public/data/daily-calendar.json.');
}

main().catch((err) => {
  console.error('\nCalendar build failed:', err);
  process.exitCode = 1;
});
