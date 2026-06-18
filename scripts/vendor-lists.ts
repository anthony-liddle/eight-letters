// scripts/vendor-lists.ts
// Manual, network-touching, one-time. Downloads the raw ENABLE list and the
// SCOWL tarball, writes the lists the offline build reads into scripts/data-raw,
// and records provenance. Run by hand:  pnpm data:vendor
// Never called by the build, CI, or tests.
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { SCOWL_VARIANTS, SIZE_95_SIZES } from './lib/config.ts';
import {
  CACHE_DIR,
  DATA_RAW_DIR,
  ensureDir,
  fetchText,
  sleep,
} from './lib/util.ts';

const execFileAsync = promisify(execFile);

const ENABLE_URL =
  'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt';
const SCOWL_VERSION = '2020.12.07';
const SCOWL_TARBALL_URL = `https://downloads.sourceforge.net/project/wordlist/SCOWL/${SCOWL_VERSION}/scowl-${SCOWL_VERSION}.tar.gz`;

async function vendorEnable(): Promise<void> {
  const raw = await fetchText(ENABLE_URL);
  await writeFile(join(DATA_RAW_DIR, 'enable1.txt'), raw, 'utf8');
}

async function downloadBinary(url: string, retries = 3): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError;
}

async function vendorScowl(): Promise<void> {
  await ensureDir(CACHE_DIR);
  const tarball = join(CACHE_DIR, 'scowl.tar.gz');
  const extractRoot = join(CACHE_DIR, 'scowl');
  const buf = await downloadBinary(SCOWL_TARBALL_URL);
  await writeFile(tarball, buf);
  await ensureDir(extractRoot);
  await execFileAsync('tar', [
    'xzf',
    tarball,
    '-C',
    extractRoot,
    '--strip-components=1',
  ]);
  const outDir = join(DATA_RAW_DIR, 'scowl');
  await ensureDir(outDir);
  for (const variant of SCOWL_VARIANTS) {
    for (const size of SIZE_95_SIZES) {
      const name = `${variant}-words.${size}`;
      try {
        const band = await readFile(join(extractRoot, 'final', name), 'latin1');
        await writeFile(join(outDir, name), band, 'latin1');
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        // Missing variant/size combinations are expected; skip them.
      }
    }
  }
}

async function writeProvenance(): Promise<void> {
  const note = [
    '# Vendored word list provenance',
    '',
    'These raw lists are committed so the build is fully offline and reproducible.',
    'The ENABLE list and SCOWL are frozen, so reading these local files is safe forever.',
    'Refresh them only by re-running:  pnpm data:vendor',
    '',
    '## ENABLE',
    '',
    `- Source: ${ENABLE_URL}`,
    '- License: public domain.',
    `- Vendored: ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## SCOWL',
    '',
    `- Source: ${SCOWL_TARBALL_URL}`,
    `- Version: ${SCOWL_VERSION}.`,
    '- License: permissive (Kevin Atkinson). See ATTRIBUTION.md.',
    `- Vendored bands: ${SCOWL_VARIANTS.join(', ')} at sizes ${SIZE_95_SIZES.join(', ')}.`,
    `- Vendored: ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## Wiktionary (definitions and etymology)',
    '',
    '- Definitions in definitions.tsv and source-pool etymology come from Wiktionary.',
    '- License: CC BY-SA 4.0. Attribution carried here and surfaced in the colophon.',
    '',
  ].join('\n');
  await writeFile(join(DATA_RAW_DIR, 'PROVENANCE.md'), note, 'utf8');
}

async function main(): Promise<void> {
  await ensureDir(DATA_RAW_DIR);
  console.log('Vendoring ENABLE.');
  await vendorEnable();
  console.log('Vendoring SCOWL bands.');
  await vendorScowl();
  await writeProvenance();
  console.log('Done. Wrote scripts/data-raw/.');
}

main().catch((err) => {
  console.error('Vendoring failed:', err);
  process.exitCode = 1;
});
