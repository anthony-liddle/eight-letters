/**
 * ANALYSIS ONLY. Manual, read-only tool. Not wired into the build, CI, or tests.
 *
 * Read-only diagnostics on the definitions misses. No network, no data/build
 * changes. Sources, all on disk:
 *   - formable union: recomputed from enable1.txt + source-pool.json
 *   - definitions.tsv (committed)
 *   - rarity bands: public/data/common-pool.txt, beyond-size-70.txt, beyond-size-95.txt
 *   - acquisition cache: scripts/.cache/wiktionary-defs/<word>.json
 *
 * Run by hand:  pnpm tsx scripts/diagnose-misses.ts
 */
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDefinitions } from './lib/definitions.ts';
import { formableUnion } from './lib/formable.ts';
import { loadEnable } from './lib/sources.ts';
import { ASSET_DIR, CACHE_DIR, DATA_RAW_DIR } from './lib/util.ts';

type Band = 'set' | 'uncommon' | 'rare' | 'mythic';

const pct = (n: number, d: number): string =>
  d ? `${((n / d) * 100).toFixed(2)}%` : 'n/a';

async function readList(name: string): Promise<Set<string>> {
  const txt = await readFile(join(ASSET_DIR, name), 'utf8');
  return new Set(
    txt
      .split('\n')
      .map((w) => w.trim())
      .filter(Boolean),
  );
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const out: string[] = [];
  const line = (s = ''): void => void out.push(s);

  // --- Inputs -----------------------------------------------------------
  const defs = parseDefinitions(
    await readFile(join(DATA_RAW_DIR, 'definitions.tsv'), 'utf8'),
  );
  const sourceWords = (
    JSON.parse(await readFile(join(ASSET_DIR, 'source-pool.json'), 'utf8')) as {
      word: string;
    }[]
  ).map((e) => e.word);
  const enable = await loadEnable();
  const union = formableUnion(sourceWords, enable);

  const setWords = await readList('common-pool.txt');
  const beyond70 = await readList('beyond-size-70.txt'); // ENABLE minus size 70
  const beyond95 = await readList('beyond-size-95.txt'); // ENABLE minus size 95

  // Same precedence the game uses: set > uncommon(70) > rare(95) > mythic.
  const classify = (w: string): Band => {
    if (setWords.has(w)) return 'set';
    if (!beyond70.has(w)) return 'uncommon'; // inside size 70
    if (!beyond95.has(w)) return 'rare'; // inside size 95, beyond 70
    return 'mythic';
  };

  // --- Question 1: misses by rarity band --------------------------------
  const bands: Band[] = ['set', 'uncommon', 'rare', 'mythic'];
  const tally: Record<
    Band,
    { total: number; defined: number; missing: number }
  > = {
    set: { total: 0, defined: 0, missing: 0 },
    uncommon: { total: 0, defined: 0, missing: 0 },
    rare: { total: 0, defined: 0, missing: 0 },
    mythic: { total: 0, defined: 0, missing: 0 },
  };
  for (const w of union) {
    const b = classify(w);
    tally[b].total++;
    if (defs.has(w)) tally[b].defined++;
    else tally[b].missing++;
  }

  line('=== QUESTION 1: MISSES BY RARITY BAND ===');
  line(
    'classifier: set > uncommon (SCOWL 70) > rare (SCOWL 95) > mythic (beyond 95)',
  );
  line('band      total  defined  missing  coverage');
  for (const b of bands) {
    const t = tally[b];
    line(
      `${b.padEnd(9)} ${String(t.total).padStart(5)}  ${String(t.defined).padStart(7)}  ${String(t.missing).padStart(7)}  ${pct(t.defined, t.total)}`,
    );
  }
  const uT = union.length;
  const uD = union.filter((w) => defs.has(w)).length;
  line(
    `${'TOTAL'.padEnd(9)} ${String(uT).padStart(5)}  ${String(uD).padStart(7)}  ${String(uT - uD).padStart(7)}  ${pct(uD, uT)}`,
  );
  line('');
  line(
    `SET-WORD COVERAGE (the number that matters most): ${pct(tally.set.defined, tally.set.total)} (${tally.set.defined}/${tally.set.total}, ${tally.set.missing} missing)`,
  );

  // Source words must never miss.
  const srcDefined = sourceWords.filter((w) => defs.has(w)).length;
  const srcMissing = sourceWords.filter((w) => !defs.has(w));
  line('');
  line(
    `SOURCE WORDS: ${sourceWords.length} total, ${srcDefined} defined, ${srcMissing.length} missing, coverage ${pct(srcDefined, sourceWords.length)}` +
      (srcMissing.length ? ` -- MISSING: ${srcMissing.join(', ')}` : ''),
  );

  // --- Question 2: genuine absence vs recoverable failure ---------------
  const misses = union.filter((w) => !defs.has(w));
  let cachedNegative = 0; // cache file present with a real 200 body, no usable gloss
  let cachedNull = 0; // present but body null (not expected from this impl)
  let notInCache = 0; // no cache file: fetch returned null (404/timeout/network/429)
  let cachedNoEnglish = 0; // sub: cached 200 with no en section
  let cachedEnglishNoSense = 0; // sub: cached 200, en present, no usable sense

  for (const w of misses) {
    const path = join(CACHE_DIR, 'wiktionary-defs', `${w}.json`);
    if (!(await fileExists(path))) {
      notInCache++;
      continue;
    }
    const body = (
      JSON.parse(await readFile(path, 'utf8')) as {
        definitionJson: string | null;
      }
    ).definitionJson;
    if (body === null) {
      cachedNull++;
      continue;
    }
    cachedNegative++;
    try {
      const parsed = JSON.parse(body) as { en?: unknown[] };
      if (!parsed.en || parsed.en.length === 0) cachedNoEnglish++;
      else cachedEnglishNoSense++;
    } catch {
      cachedEnglishNoSense++;
    }
  }

  line('');
  line('=== QUESTION 2: GENUINE ABSENCE vs RECOVERABLE FAILURE ===');
  line(`total misses: ${misses.length}`);
  line('');
  line('NOTE on what the cache can tell us: fetchDefinitionJson caches ONLY');
  line(
    'successful HTTP 200 responses. Errors, 404s, timeouts, and rate-limits',
  );
  line('return null and are never written to disk. So error responses are not');
  line(
    'persisted, and error KINDS (network vs timeout vs 429) cannot be derived',
  );
  line('from disk. The not-in-cache bucket therefore conflates genuine 404');
  line(
    'absences with transient failures; both are re-attempted on a resumable re-run.',
  );
  line('');
  line(
    `cached negative (Wiktionary returned a 200 entry, no usable English gloss -> SETTLED absence): ${cachedNegative}`,
  );
  line(`    of which: no English section at all: ${cachedNoEnglish}`);
  line(
    `    of which: English section present but no usable sense after cleaning: ${cachedEnglishNoSense}`,
  );
  line(`cached null body (not produced by this implementation): ${cachedNull}`);
  line(
    `not in cache (fetch returned null: 404 / timeout / network / rate-limit -> a re-run RE-ATTEMPTS): ${notInCache}`,
  );
  line('');
  line(`RE-RUN of defs:acquire would RETRY: ${notInCache + cachedNull} misses`);
  line(
    `SETTLED absences a re-run would NOT change (cached negatives): ${cachedNegative}`,
  );
  line(
    `(check: ${notInCache + cachedNull} + ${cachedNegative} = ${notInCache + cachedNull + cachedNegative}, total misses = ${misses.length})`,
  );
  line('');
  line(
    'Cannot derive from disk: how many of the re-attempted misses are genuine',
  );
  line('404 absences vs transient failures (error responses were not cached).');
  line('=========================================================');

  process.stdout.write(out.join('\n') + '\n');
}

main().catch((err) => {
  console.error('Diagnostics failed:', err);
  process.exitCode = 1;
});
