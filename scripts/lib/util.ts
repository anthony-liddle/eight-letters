import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(fileURLToPath(import.meta.url), '../../..');
export const CACHE_DIR = join(REPO_ROOT, 'scripts', '.cache');
export const ASSET_DIR = join(REPO_ROOT, 'public', 'data');

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/** Read a JSON file from the disk cache, or null if it is not there yet. */
export async function readCacheJson<T>(relPath: string): Promise<T | null> {
  try {
    const raw = await readFile(join(CACHE_DIR, relPath), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCacheJson(
  relPath: string,
  value: unknown,
): Promise<void> {
  const full = join(CACHE_DIR, relPath);
  await ensureDir(dirname(full));
  await writeFile(full, JSON.stringify(value), 'utf8');
}

export async function writeAsset(
  name: string,
  contents: string,
): Promise<void> {
  await ensureDir(ASSET_DIR);
  await writeFile(join(ASSET_DIR, name), contents, 'utf8');
}

/** Fetch with a few retries and a clear failure. Build-time only. */
export async function fetchText(
  url: string,
  init?: RequestInit,
  retries = 3,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run tasks with a bounded number in flight at once. Preserves input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T, index);
      done++;
      onProgress?.(done, items.length);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(runners);
  return results;
}
