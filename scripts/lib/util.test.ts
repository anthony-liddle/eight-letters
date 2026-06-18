import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchText, parseRetryAfterMs } from './util.ts';

function resp(
  status: number,
  body = '',
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    text: async () => body,
  } as unknown as Response;
}

describe('parseRetryAfterMs', () => {
  it("returns delta-seconds * 1000 for '2'", () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
  });

  it('trims whitespace before parsing delta-seconds', () => {
    expect(parseRetryAfterMs('  5 ')).toBe(5000);
  });

  it('returns null for null input', () => {
    expect(parseRetryAfterMs(null)).toBeNull();
  });

  it('returns null for non-numeric garbage', () => {
    expect(parseRetryAfterMs('banana')).toBeNull();
  });

  it('returns approximately the delta for an HTTP-date in the future', () => {
    const now = 1_700_000_000_000;
    const future = now + 8_000;
    const dateStr = new Date(future).toUTCString();
    const result = parseRetryAfterMs(dateStr, now);
    expect(result).toBe(8000);
  });

  it('caps a huge delta-seconds value at RETRY_AFTER_MAX_MS (60000)', () => {
    expect(parseRetryAfterMs('9999')).toBe(60000);
  });

  it('caps a far-future HTTP-date at RETRY_AFTER_MAX_MS (60000)', () => {
    const now = 1_700_000_000_000;
    const farFuture = now + 120_000;
    const dateStr = new Date(farFuture).toUTCString();
    expect(parseRetryAfterMs(dateStr, now)).toBe(60000);
  });
});

describe('fetchText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retries on a 500 then succeeds on 200, fetch called twice', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(resp(500))
      .mockResolvedValueOnce(resp(200, 'success body'));
    vi.stubGlobal('fetch', mockFetch);

    const promise = fetchText('https://example.com');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success body');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on a 429 then succeeds, fetch called twice', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(resp(429))
      .mockResolvedValueOnce(resp(200, 'ok body'));
    vi.stubGlobal('fetch', mockFetch);

    const promise = fetchText('https://example.com');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok body');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('eventually succeeds across a [500, 429, 200] sequence', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(resp(500))
      .mockResolvedValueOnce(resp(429))
      .mockResolvedValueOnce(resp(200, 'final body'));
    vi.stubGlobal('fetch', mockFetch);

    const promise = fetchText('https://example.com');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('final body');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('honors Retry-After header: waits the header duration before retrying', async () => {
    // 429 with retry-after: 5 seconds, then 200
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(resp(429, '', { 'retry-after': '5' }))
      .mockResolvedValueOnce(resp(200, 'waited body'));
    vi.stubGlobal('fetch', mockFetch);

    const promise = fetchText('https://example.com');

    // Let the first fetch resolve (429 response)
    await vi.advanceTimersByTimeAsync(0);
    // After 4000ms the second fetch should NOT have fired yet
    await vi.advanceTimersByTimeAsync(4000);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // After the remaining 1000ms it should fire
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await promise;
  });

  it('does NOT retry a 404: rejects immediately, fetch called exactly once', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(resp(404));
    vi.stubGlobal('fetch', mockFetch);

    let caughtError: unknown;
    try {
      await fetchText('https://example.com');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain('HTTP 404');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting retries budget (all 500s)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(resp(500));
    vi.stubGlobal('fetch', mockFetch);

    let caughtError: unknown;
    const promise = fetchText('https://example.com', undefined, 2).catch(
      (err) => {
        caughtError = err;
      },
    );
    await vi.runAllTimersAsync();
    await promise;

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain('HTTP 500');
    // 1 initial + 2 retries = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('retries on a network failure (thrown fetch error)', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(resp(200, 'recovered'));
    vi.stubGlobal('fetch', mockFetch);

    const promise = fetchText('https://example.com');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('recovered');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
