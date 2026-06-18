// src/data/definitions.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefinitionLookup } from './definitions.ts';

function mockFetch(bundles: Record<string, Record<string, string>>) {
  return vi.fn(async (url: string) => {
    const match = url.match(/data\/defs\/([a-z]+)\.json$/);
    const word = match?.[1] ?? '';
    const bundle = bundles[word];
    if (!bundle) return { ok: false, status: 404 } as Response;
    return {
      ok: true,
      status: 200,
      json: async () => bundle,
    } as unknown as Response;
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('createDefinitionLookup', () => {
  it('returns the definition for a present word and null for an absent one', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ audience: { sea: 'a body of salt water' } }),
    );
    const lookup = createDefinitionLookup('audience');
    expect(await lookup.getDefinition('sea')).toBe('a body of salt water');
    expect(await lookup.getDefinition('xyz')).toBeNull();
  });

  it('loads the bundle at most once across repeated lookups', async () => {
    const fetchSpy = mockFetch({ audience: { sea: 'a body of salt water' } });
    vi.stubGlobal('fetch', fetchSpy);
    const lookup = createDefinitionLookup('audience');
    await Promise.all([
      lookup.getDefinition('sea'),
      lookup.getDefinition('sea'),
    ]);
    await lookup.getDefinition('sea');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not load a bundle for an unrelated puzzle', async () => {
    const fetchSpy = mockFetch({ audience: {}, password: {} });
    vi.stubGlobal('fetch', fetchSpy);
    const lookup = createDefinitionLookup('audience');
    await lookup.getDefinition('sea');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0] as string).toContain('audience.json');
    expect(fetchSpy.mock.calls[0]?.[0] as string).not.toContain(
      'password.json',
    );
  });

  it('resolves every word to null when the bundle is missing', async () => {
    vi.stubGlobal('fetch', mockFetch({}));
    const lookup = createDefinitionLookup('missing');
    expect(await lookup.getDefinition('sea')).toBeNull();
  });
});
