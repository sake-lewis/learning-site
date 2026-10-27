import { describe, expect, it } from 'vitest';
import { checkRequest, type GuardInput, type GuardPolicy } from './guard.ts';

const policy: GuardPolicy = {
  allowedHosts: ['127.0.0.1:5178', 'localhost:5178'],
  allowedOrigins: ['http://127.0.0.1:5178', 'http://localhost:5178'],
  sessionToken: 'a'.repeat(43),
};

const base: GuardInput = { path: '/api/tts', host: '127.0.0.1:5178', origin: undefined, fetchSite: 'same-origin', token: policy.sessionToken };

describe('localhost guard', () => {
  it('accepts a same-origin API call with the session token', () => {
    expect(checkRequest(base, policy)).toEqual({ ok: true });
  });

  it('rejects a foreign Host header (DNS rebinding)', () => {
    expect(checkRequest({ ...base, host: 'evil.example:5178' }, policy)).toMatchObject({ ok: false, status: 403, code: 'BAD_HOST' });
    expect(checkRequest({ ...base, path: '/', host: undefined }, policy)).toMatchObject({ ok: false, code: 'BAD_HOST' });
  });

  it('rejects a foreign Origin', () => {
    expect(checkRequest({ ...base, origin: 'http://localhost:8080' }, policy)).toMatchObject({ ok: false, status: 403, code: 'BAD_ORIGIN' });
  });

  it('rejects API calls without the right token', () => {
    expect(checkRequest({ ...base, token: undefined }, policy)).toMatchObject({ ok: false, status: 401 });
    expect(checkRequest({ ...base, token: 'b'.repeat(43) }, policy)).toMatchObject({ ok: false, status: 401 });
    expect(checkRequest({ ...base, token: 'short' }, policy)).toMatchObject({ ok: false, status: 401 });
  });

  it('serves the session token only to the same origin', () => {
    const session = { ...base, path: '/api/session', token: undefined };
    expect(checkRequest(session, policy)).toEqual({ ok: true });
    expect(checkRequest({ ...session, fetchSite: 'same-site' }, policy)).toMatchObject({ ok: false, code: 'CROSS_SITE' });
    expect(checkRequest({ ...session, fetchSite: 'cross-site' }, policy)).toMatchObject({ ok: false, code: 'CROSS_SITE' });
  });

  it('applies the token check whatever the case of the path', () => {
    expect(checkRequest({ ...base, path: '/API/voices', token: undefined }, policy)).toMatchObject({ ok: false, status: 401 });
    expect(checkRequest({ ...base, path: '/Api', token: undefined }, policy)).toMatchObject({ ok: false, status: 401 });
    expect(checkRequest({ ...base, path: '/API/SESSION', token: undefined, fetchSite: 'cross-site' }, policy)).toMatchObject({ ok: false, code: 'CROSS_SITE' });
  });

  it('lets pages through with only the Host check', () => {
    expect(checkRequest({ ...base, path: '/', token: undefined }, policy)).toEqual({ ok: true });
  });
});
