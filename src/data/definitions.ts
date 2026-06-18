// src/data/definitions.ts
// The single seam between stored definitions and the UI. Lazy, cached, same
// origin. The storage shape behind it (per-puzzle bundles today) can change
// without touching callers.

export interface DefinitionLookup {
  getDefinition(word: string): Promise<string | null>;
}

type Bundle = Record<string, string>;

function bundleUrl(sourceWord: string): string {
  return `${import.meta.env.BASE_URL}data/defs/${sourceWord}.json`;
}

async function fetchBundle(sourceWord: string): Promise<Bundle> {
  try {
    const res = await fetch(bundleUrl(sourceWord));
    if (!res.ok) return {};
    return (await res.json()) as Bundle;
  } catch {
    return {};
  }
}

/**
 * Lookup for one puzzle. The bundle loads on first lookup and is cached, so a
 * session loads exactly the definitions for its rack and nothing else. Missing
 * words resolve to null for a graceful no definition state.
 */
export function createDefinitionLookup(sourceWord: string): DefinitionLookup {
  let pending: Promise<Bundle> | null = null;
  const load = (): Promise<Bundle> => {
    if (!pending) pending = fetchBundle(sourceWord);
    return pending;
  };
  return {
    async getDefinition(word: string): Promise<string | null> {
      const bundle = await load();
      return bundle[word] ?? null;
    },
  };
}
