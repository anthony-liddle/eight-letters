/**
 * Build-time data pipeline. Runs offline, bakes static assets the engine loads.
 * Rerunnable: Wiktionary responses are cached on disk, so reruns are cheap.
 *
 *   pnpm data:build
 *
 * Outputs to public/data/:
 *   enable.txt        newline list, the full validation set
 *   common-pool.txt   newline list, the tier denominator (SCOWL small INTERSECT ENABLE)
 *   source-pool.json  [{ word, definition, etymology }], the answer pool
 *   meta.json         counts, attribution, generated timestamp
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  MAX_SOURCE_WORDS,
  RARE_THRESHOLD_SIZES,
  REQUIRE_ETYMOLOGY,
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

  console.log('SCOWL: deriving rare set (ENABLE minus SCOWL size 70).');
  const scowl70 = new Set(await loadScowlWords(RARE_THRESHOLD_SIZES));
  const rare = enable.filter((w) => !scowl70.has(w));
  await writeAsset('rare.txt', rare.join('\n'));
  console.log(
    `  ${rare.length.toLocaleString()} rare words ` +
      `(${((rare.length / enable.length) * 100).toFixed(0)}% of ENABLE).`,
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
      rare: rare.length,
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
