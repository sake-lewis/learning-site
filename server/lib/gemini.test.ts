import { createServer } from 'node:net';
import { GoogleGenAI } from '@google/genai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { failedToConnect, networkCode, once, toUpstreamError, UpstreamError } from './gemini.ts';

/** A local port that refuses connections: opened, then closed again. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (typeof address !== 'object' || address === null) throw new Error('No port');
  return address.port;
}

/** The real SDK pointed at a closed local port: the same error chain as an unreachable Google, without the network. */
async function sdkPointedAt(port: number) {
  return new GoogleGenAI({ apiKey: 'not-a-real-key', httpOptions: { baseUrl: `http://127.0.0.1:${port}` } });
}

/** The error the SDK raises when the connection was reset, possibly after the request was sent. */
function resetError(): Error {
  const socket = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
  const fetchError = new TypeError('fetch failed', { cause: socket });
  const wrapped = new Error(`Unable to make request: ${fetchError}`, { cause: fetchError });
  wrapped.name = 'APIConnectionError';
  return wrapped;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Google connection failures', () => {
  it('reads the system code under the SDK error and maps it to UNREACHABLE, not "Google returned an error"', async () => {
    const ai = await sdkPointedAt(await closedPort());
    const error = await ai.voices.list({ page_size: 1 }, { maxRetries: 0 }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(networkCode(error)).toBe('ECONNREFUSED');
    expect(failedToConnect(error)).toBe(true);
    const mapped = toUpstreamError(error);
    expect(mapped).toMatchObject({ status: 502, code: 'UNREACHABLE' });
    expect(mapped.detail).toContain('fetch failed');
    expect(mapped.detail).toContain('(ECONNREFUSED)');
  });

  it('tries a connection that never opened once more, then reports it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ai = await sdkPointedAt(await closedPort());
    let calls = 0;
    const failure = await once(undefined, (options) => {
      calls++;
      return ai.voices.list({ page_size: 1 }, options);
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(calls).toBe(2);
    expect(failure).toBeInstanceOf(UpstreamError);
    expect(failure).toMatchObject({ code: 'UNREACHABLE' });
  });

  it('returns the second attempt when the connection opens on retry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ai = await sdkPointedAt(await closedPort());
    let calls = 0;
    const result = await once(undefined, async (options) => {
      calls++;
      if (calls === 1) await ai.voices.list({ page_size: 1 }, options);
      return 'audio';
    });
    expect(result).toBe('audio');
    expect(calls).toBe(2);
  });

  it('never retries a reset connection or an answer from Google, which may have spent quota', async () => {
    let calls = 0;
    const reset = await once(undefined, async () => {
      calls++;
      throw resetError();
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(calls).toBe(1);
    expect(reset).toMatchObject({ code: 'UNREACHABLE' });

    calls = 0;
    const refused = await once(undefined, async () => {
      calls++;
      throw Object.assign(new Error('{"error":{"message":"Invalid voice"}}'), { status: 400 });
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(calls).toBe(1);
    expect(refused).toMatchObject({ code: 'BAD_REQUEST' });
  });
});
