// Client for the local server. Every call carries the per-launch session token (spec S2).
import {
  ApiErrorSchema,
  CapabilitiesSchema,
  HealthSchema,
  SessionSchema,
  VoiceListSchema,
  VoiceSummarySchema,
  type Capabilities,
  type CreateVoiceBody,
  type Health,
  type QuotaScope,
  type TtsRequest,
  type VoiceSummary,
} from '../../shared/schemas.ts';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: string | undefined;
  /** For QUOTA errors: whether Google's per-day or per-minute quota ran out. */
  readonly scope: QuotaScope | undefined;
  readonly retryAfterSec: number | undefined;

  constructor(code: string, status: number, message: string, detail?: string, quota?: { scope?: QuotaScope; retryAfterSec?: number }) {
    super(message);
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.scope = quota?.scope;
    this.retryAfterSec = quota?.retryAfterSec;
  }
}

let tokenPromise: Promise<string> | null = null;

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = ApiErrorSchema.parse(await res.json());
    return new ApiError(body.code, res.status, body.message, body.detail, body);
  } catch {
    return new ApiError('UPSTREAM', res.status, res.statusText || `HTTP ${res.status}`);
  }
}

/** Network and abort failures while sending or reading a response, as stable codes. */
function transportError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return new ApiError('CANCELLED', 0, 'Cancelled');
  return new ApiError('NETWORK', 0, String(error));
}

function sessionToken(): Promise<string> {
  tokenPromise ??= fetch('/api/session')
    .then(async (res) => {
      if (!res.ok) throw await toApiError(res);
      return SessionSchema.parse(await res.json()).token;
    })
    .catch((error: unknown) => {
      tokenPromise = null;
      throw error instanceof ApiError ? error : new ApiError('NETWORK', 0, String(error));
    });
  return tokenPromise;
}

async function call(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Timbre-Token', await sessionToken());
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (error) {
    throw transportError(error);
  }
  if (!res.ok) {
    const error = await toApiError(res);
    // The server makes a new token on each launch: refresh it once after a restart. Only the local
    // guard's BAD_TOKEN qualifies, so an upstream failure is never sent to Google twice.
    if (error.code === 'BAD_TOKEN' && !retried) {
      tokenPromise = null;
      return call(path, init, true);
    }
    throw error;
  }
  return res;
}

/** Reads a response body, mapping a cancel or dropped connection during the read like a send error. */
async function read<T>(res: Response, parse: (res: Response) => Promise<T>): Promise<T> {
  try {
    return await parse(res);
  } catch (error) {
    throw transportError(error);
  }
}

export async function getHealth(): Promise<Health> {
  return HealthSchema.parse(await (await call('/api/health')).json());
}

export async function getCapabilities(): Promise<Capabilities> {
  return CapabilitiesSchema.parse(await (await call('/api/capabilities')).json());
}

// ---------- Voice Lab ----------

export async function listVoices(): Promise<VoiceSummary[]> {
  return VoiceListSchema.parse(await (await call('/api/voices')).json()).voices;
}

export async function getVoice(id: string): Promise<VoiceSummary> {
  return VoiceSummarySchema.parse(await (await call(`/api/voices/${encodeURIComponent(id)}`)).json());
}

export async function createVoice(body: CreateVoiceBody, signal?: AbortSignal): Promise<VoiceSummary> {
  const res = await call('/api/voices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  return VoiceSummarySchema.parse(await read(res, (r) => r.json()));
}

/** Deletes a stored voice at Google; a voice already gone (404) counts as deleted. */
export async function deleteVoice(id: string): Promise<void> {
  try {
    await call(`/api/voices/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return;
    throw error;
  }
}

export interface SynthesisResult {
  blob: Blob;
  seconds: number;
  cached: boolean;
}

export async function synthesize(request: TtsRequest, signal: AbortSignal): Promise<SynthesisResult> {
  const res = await call('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  const bytes = await read(res, (r) => r.arrayBuffer());
  return {
    blob: new Blob([bytes], { type: 'audio/wav' }),
    seconds: Number(res.headers.get('X-Audio-Seconds') ?? 0),
    cached: res.headers.get('X-Cache') === 'hit',
  };
}
