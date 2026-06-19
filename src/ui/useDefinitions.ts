// Owns one definition lookup per puzzle. Warms the bundle on ready so the modal
// opens instantly, and recreates the lookup when the source word changes.
import { useCallback, useEffect, useMemo } from 'react';
import {
  createDefinitionLookup,
  type DefinitionLookup,
} from '@/data/definitions.ts';

export interface Definitions {
  getDefinition(word: string): Promise<string | null>;
}

export function useDefinitions(sourceWord: string): Definitions {
  const lookup: DefinitionLookup = useMemo(
    () => createDefinitionLookup(sourceWord),
    [sourceWord],
  );

  // Warm the bundle when the puzzle becomes ready (and on every source change),
  // so the roughly 9 KB gzipped bundle is usually cached before the first tap.
  useEffect(() => {
    lookup.warm();
  }, [lookup]);

  const getDefinition = useCallback(
    (word: string) => lookup.getDefinition(word),
    [lookup],
  );

  return { getDefinition };
}
