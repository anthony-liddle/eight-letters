/**
 * Build-time data pipeline. Runs offline, bakes static assets the engine loads.
 * Rerunnable: Wiktionary responses are cached on disk, so reruns are cheap.
 *
 *   pnpm data:build
 *
 * Outputs to public/data/:
 *   enable.txt           newline list, the full validation set
 *   common-pool.txt      newline list, the set / completion denominator (SCOWL small INTERSECT ENABLE)
 *   beyond-size-70.txt   newline list, ENABLE minus SCOWL size 70: the rarity-ladder cut at 70
 *   beyond-size-95.txt   newline list, ENABLE minus SCOWL size 95: the rarity-ladder cut at 95
 *   source-pool.json     [{ word, definition, etymology }], the answer pool
 *   meta.json            counts, attribution, generated timestamp
 *
 * The two beyond-size files are the compact complements that drive the off-page
 * rarity ladder. A formable validation word is uncommon if it is in neither
 * (i.e. inside size 70), rare if it is in beyond-70 but not beyond-95, and
 * mythic if it is in beyond-95. Shipping the complements rather than the full
 * positive size-70 and size-95 lists keeps the payload light and giftable while
 * classifying every word identically.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  MAX_SOURCE_WORDS,
  REQUIRE_ETYMOLOGY,
  SIZE_70_SIZES,
  SIZE_95_SIZES,
  WIKTIONARY_CONCURRENCY,
} from './lib/config.ts';
import {
  loadCommonPool,
  loadEnable,
  loadScowlWords,
  loadSourceCandidates,
} from './lib/sources.ts';
import { enrichWord, type WordEntry } from './lib/wiktionary.ts';
import { REPO_ROOT, mapWithConcurrency, writeAsset } from './lib/util.ts';

async function loadExcludeList(): Promise<Set<string>> {
  try {
    const raw = await readFile(
      join(REPO_ROOT, 'scripts', 'source-exclude.txt'),
      'utf8',
    );
    const out = new Set<string>();
    for (const line of raw.split('\n')) {
      const w = line.trim().toLowerCase();
      if (w && !w.startsWith('#')) out.add(w);
    }
    return out;
  } catch {
    return new Set();
  }
}

async function main(): Promise<void> {
  console.log('Building data assets.\n');

  console.log('ENABLE: fetching validation set.');
  const enable = await loadEnable();
  const enableSet = new Set(enable);
  await writeAsset('enable.txt', enable.join('\n'));
  console.log(`  ${enable.length.toLocaleString()} words.`);

  console.log('SCOWL: deriving common pool.');
  const commonRaw = await loadCommonPool();
  // Every counted word must be findable, so the denominator lives inside ENABLE.
  const common = commonRaw.filter((w) => enableSet.has(w));
  await writeAsset('common-pool.txt', common.join('\n'));
  console.log(
    `  ${common.length.toLocaleString()} common words ` +
      `(${(commonRaw.length - common.length).toLocaleString()} dropped as not in ENABLE).`,
  );

  console.log(
    'SCOWL: deriving rarity bands (ENABLE minus size 70 and size 95).',
  );
  const scowl70 = new Set(await loadScowlWords(SIZE_70_SIZES));
  const scowl95 = new Set(await loadScowlWords(SIZE_95_SIZES));
  const beyond70 = enable.filter((w) => !scowl70.has(w));
  const beyond95 = enable.filter((w) => !scowl95.has(w));
  await writeAsset('beyond-size-70.txt', beyond70.join('\n'));
  await writeAsset('beyond-size-95.txt', beyond95.join('\n'));
  console.log(
    `  ${beyond70.length.toLocaleString()} beyond size 70 ` +
      `(${((beyond70.length / enable.length) * 100).toFixed(0)}% of ENABLE), ` +
      `${beyond95.length.toLocaleString()} beyond size 95 ` +
      `(${((beyond95.length / enable.length) * 100).toFixed(0)}%).`,
  );

  console.log('SCOWL: deriving 8-letter source candidates.');
  const exclude = await loadExcludeList();
  const candidates = (await loadSourceCandidates())
    .filter((w) => enableSet.has(w)) // must be a submittable answer
    .filter((w) => !exclude.has(w)) // hand-review drops
    .slice(0, MAX_SOURCE_WORDS);
  console.log(
    `  ${candidates.length} candidates to enrich ` +
      `(${exclude.size} excluded by hand).`,
  );

  console.log('Wiktionary: fetching definitions and etymologies.');
  const enriched = await mapWithConcurrency(
    candidates,
    WIKTIONARY_CONCURRENCY,
    enrichWord,
    (done, total) => {
      if (done % 25 === 0 || done === total) {
        process.stdout.write(`  ${done}/${total}\r`);
      }
    },
  );
  process.stdout.write('\n');

  const sourcePool: WordEntry[] = enriched.filter(
    (e) => e.definition && (REQUIRE_ETYMOLOGY ? e.etymology : true),
  );
  sourcePool.sort((a, b) => a.word.localeCompare(b.word));
  await writeAsset('source-pool.json', JSON.stringify(sourcePool));
  console.log(
    `  ${sourcePool.length} source words kept ` +
      `(${enriched.length - sourcePool.length} dropped for missing definition or etymology).`,
  );

  const meta = {
    generatedAt: new Date().toISOString(),
    counts: {
      enable: enable.length,
      common: common.length,
      beyond70: beyond70.length,
      beyond95: beyond95.length,
      sourcePool: sourcePool.length,
    },
    attribution: {
      enable: 'ENABLE word list. Public domain.',
      scowl:
        'SCOWL (Spell Checker Oriented Word Lists) by Kevin Atkinson. See ATTRIBUTION.md.',
      wiktionary:
        'Definitions and etymologies from Wiktionary, CC BY-SA 4.0. See ATTRIBUTION.md.',
    },
  };
  await writeAsset('meta.json', JSON.stringify(meta, null, 2));

  console.log('\nDone. Assets written to public/data/.');
}

main().catch((err) => {
  console.error('\nData build failed:', err);
  process.exitCode = 1;
});
