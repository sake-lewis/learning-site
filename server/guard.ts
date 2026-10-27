// Localhost guard (spec S2): blocks DNS rebinding, cross-site requests and token-less API calls.
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface GuardInput {
  path: string;
  host: string | undefined;
  origin: string | undefined;
  fetchSite: string | undefined;
  token: string | undefined;
}

export interface GuardPolicy {
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
  sessionToken: string;
}

export type GuardResult = { ok: true } | { ok: false; status: 401 | 403; code: string };

function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function checkRequest(input: GuardInput, policy: GuardPolicy): GuardResult {
  if (!input.host || !policy.allowedHosts.includes(input.host.toLowerCase())) {
    return { ok: false, status: 403, code: 'BAD_HOST' };
  }
  if (input.origin && !policy.allowedOrigins.includes(input.origin.toLowerCase())) {
    return { ok: false, status: 403, code: 'BAD_ORIGIN' };
  }
  // Express routes ignore case ("/API/tts" reaches "/api/tts"), so the guard must too.
  const path = input.path.toLowerCase();
  if (path !== '/api' && !path.startsWith('/api/')) return { ok: true };

  if (path === '/api/session' || path === '/api/session/') {
    // Only the app's own page may read the token; "same-site" covers other ports on localhost.
    const site = input.fetchSite;
    if (site && site !== 'same-origin' && site !== 'none') {
      return { ok: false, status: 403, code: 'CROSS_SITE' };
    }
    return { ok: true };
  }
  if (!input.token || !sameToken(input.token, policy.sessionToken)) {
    return { ok: false, status: 401, code: 'BAD_TOKEN' };
  }
  return { ok: true };
}

export function guardMiddleware(policy: GuardPolicy) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = checkRequest(
      {
        path: req.path,
        host: req.headers.host,
        origin: req.headers.origin,
        fetchSite: req.get('sec-fetch-site'),
        token: req.get('x-timbre-token'),
      },
      policy,
    );
    if (result.ok) return next();
    res.status(result.status).json({ code: result.code, message: 'Request refused by the local guard' });
  };
}
