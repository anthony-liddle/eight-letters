import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDefinitions } from './useDefinitions.ts';

function mockFetch(bundles: Record<string, Record<string, string>>) {
  return vi.fn(async (url: string) => {
    const word = url.match(/data\/defs\/([a-z]+)\.json$/)?.[1] ?? '';
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

describe('useDefinitions', () => {
  it('warms on mount so the bundle is fetched before any lookup', async () => {
    const fetchSpy = mockFetch({ audience: { sea: 'a body of salt water' } });
    vi.stubGlobal('fetch', fetchSpy);
    renderHook(() => useDefinitions('audience'));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('audience.json');
  });

  it('resolves a definition through the lookup', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ audience: { sea: 'a body of salt water' } }),
    );
    const { result } = renderHook(() => useDefinitions('audience'));
    expect(await result.current.getDefinition('sea')).toBe(
      'a body of salt water',
    );
    expect(await result.current.getDefinition('xyz')).toBeNull();
  });

  it('rebuilds and rewarms when the source word changes', async () => {
    const fetchSpy = mockFetch({ audience: {}, password: {} });
    vi.stubGlobal('fetch', fetchSpy);
    const { rerender } = renderHook(({ w }) => useDefinitions(w), {
      initialProps: { w: 'audience' },
    });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    rerender({ w: 'password' });
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1]?.[0]).toContain('password.json');
  });
});
