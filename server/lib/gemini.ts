// The only module that talks to Google (spec 7.1). Uses the Interactions API shapes of spec section 2.
// Every call sends at most one request (retries belong to the client's queue, where they can see the
// free-tier quota) and is bounded by LIMITS.upstreamTimeoutMs. Only a connection that never opened,
// so nothing reached Google, is tried a second time.
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { GoogleGenAI } from '@google/genai';
import { encodeWavPcm16 } from '../../shared/wav.ts';
import type { CreateVoiceBody, QuotaScope, TtsRequest, VoiceSummary } from '../../shared/schemas.ts';
import { LIMITS, MODELS } from '../config.ts';

// Applies to the SDK's fetch too (checked on this PC: 100 ms reproduces "fetch failed", 2 s connects).
setDefaultAutoSelectFamilyAttemptTimeout(LIMITS.connectAttemptMs);

// System codes of a connection that failed before any byte was sent. ECONNRESET is left out: the
// request may already have reached Google.
const CONNECT_FAILURES = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);

export class UpstreamError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string | undefined;
  readonly scope: QuotaScope | undefined;
  readonly retryAfterSec: number | undefined;

  constructor(status: number, code: string, message: string, detail?: string, quota?: { scope: QuotaScope; retryAfterSec?: number }) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.scope = quota?.scope;
    this.retryAfterSec = quota?.retryAfterSec;
  }

  toJSON() {
    return { code: this.code, message: this.message, detail: this.detail, scope: this.scope, retryAfterSec: this.retryAfterSec };
  }
}

let client: GoogleGenAI | null = null;

export function hasKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new UpstreamError(503, 'KEY_MISSING', 'No Gemini API key: add GEMINI_API_KEY to the .env file, then restart.');
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** One attempt, a real deadline, and the caller's cancellation. The SDK ignores `timeout_ms` once a signal is set. */
function requestOptions(signal?: AbortSignal) {
  const deadline = AbortSignal.timeout(LIMITS.upstreamTimeoutMs);
  return { deadline, options: { maxRetries: 0, signal: signal ? AbortSignal.any([signal, deadline]) : deadline } };
}

function redact(text: string): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  let out = text.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]');
  if (key && key.length >= 8) out = out.split(key).join('[redacted]');
  return out;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const e = error as { status?: unknown; statusCode?: unknown; httpMeta?: { response?: { status?: unknown } } };
  for (const candidate of [e.status, e.statusCode, e.httpMeta?.response?.status]) {
    if (typeof candidate === 'number') return candidate;
  }
  return undefined;
}

interface GoogleErrorBody {
  message?: string;
  details?: { '@type'?: string; retryDelay?: string; violations?: { quotaId?: string; quotaMetric?: string }[] }[];
}

/** Google's structured error, from the SDK's parsed body or from the JSON at the end of its message. */
export function googleErrorBody(error: unknown): GoogleErrorBody | undefined {
  const e = error as { error?: { error?: GoogleErrorBody } & GoogleErrorBody; message?: string } | null;
  if (e?.error?.error) return e.error.error;
  if (e?.error?.message || e?.error?.details) return e.error;
  const message = typeof e?.message === 'string' ? e.message : '';
  const start = message.indexOf('{');
  if (start < 0) return undefined;
  try {
    const parsed = JSON.parse(message.slice(start)) as { error?: GoogleErrorBody };
    return parsed.error ?? (parsed as GoogleErrorBody);
  } catch {
    return undefined;
  }
}

/** Reads which quota ran out (per day or per minute) and how long Google asks to wait. */
export function quotaInfo(body: GoogleErrorBody | undefined): { scope: QuotaScope; retryAfterSec?: number } {
  const ids = (body?.details ?? []).flatMap((d) => (d.violations ?? []).map((v) => `${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`)).join(' ');
  const text = `${ids} ${body?.message ?? ''}`;
  const delay = body?.details?.find((d) => d.retryDelay)?.retryDelay;
  const retryAfterSec = delay ? Math.ceil(Number.parseFloat(delay)) : undefined;
  const scope: QuotaScope = /per.?day|daily/i.test(text) ? 'day' : /per.?minute|per.?min\b/i.test(text) ? 'minute' : 'unknown';
  return { scope, ...(Number.isFinite(retryAfterSec) ? { retryAfterSec } : {}) };
}

/**
 * The system code under a network failure. The SDK wraps Node's fetch error, which wraps the socket
 * error: APIConnectionError → ConnectionError → TypeError "fetch failed" → { code: "ETIMEDOUT" }.
 */
export function networkCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && code) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function isConnectionError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'APIConnectionError' || error.name === 'ConnectionError');
}

/** True when the connection to Google never opened, so the request was not sent and costs no quota. */
export function failedToConnect(error: unknown): boolean {
  const code = networkCode(error);
  return isConnectionError(error) && code !== undefined && CONNECT_FAILURES.has(code);
}

/** Maps any SDK or network failure to a stable code the client can explain; never leaks the key. */
export function toUpstreamError(error: unknown): UpstreamError {
  if (error instanceof UpstreamError) return error;
  const body = googleErrorBody(error);
  const raw = body?.message ?? (error instanceof Error ? error.message : String(error));
  const detail = redact(raw).slice(0, 400);
  const name = error instanceof Error ? error.name : '';
  if (name.includes('Timeout')) return new UpstreamError(504, 'TIMEOUT', 'Google did not answer in time.', detail);
  if (name.includes('Abort')) return new UpstreamError(499, 'CANCELLED', 'Generation cancelled.');
  if (isConnectionError(error)) {
    // Google never answered: not "Google returned an error". The system code says why (timeout, DNS…).
    const code = networkCode(error);
    return new UpstreamError(502, 'UNREACHABLE', 'Google could not be reached from this PC.', code ? `${detail} (${code})` : detail);
  }
  switch (statusOf(error)) {
    case 400:
      return new UpstreamError(400, 'BAD_REQUEST', 'Google rejected the request.', detail);
    case 401:
      // Not 401: the browser keeps 401 for an expired local session token.
      return new UpstreamError(502, 'KEY_INVALID', 'The Gemini API key is invalid.', detail);
    case 403:
      return new UpstreamError(403, 'FORBIDDEN', 'This key may not use this feature (billing, region or permissions).', detail);
    case 404:
      return new UpstreamError(404, 'MODEL_NOT_FOUND', 'Model or voice not found for this key.', detail);
    case 429:
      return new UpstreamError(429, 'QUOTA', 'Google free-tier quota reached.', detail, quotaInfo(body));
    default:
      return new UpstreamError(502, 'UPSTREAM', 'Google returned an error.', detail);
  }
}

/**
 * Runs one SDK call with the request options and converts the deadline into TIMEOUT. A connection
 * that never opened is tried once more after a short pause: no request reached Google, so no quota.
 */
export async function once<T>(signal: AbortSignal | undefined, call: (options: ReturnType<typeof requestOptions>['options']) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { deadline, options } = requestOptions(signal);
    try {
      return await call(options);
    } catch (error) {
      if (deadline.aborted && !signal?.aborted) throw new UpstreamError(504, 'TIMEOUT', 'Google did not answer in time.');
      if (signal?.aborted) throw new UpstreamError(499, 'CANCELLED', 'Generation cancelled.');
      if (failedToConnect(error)) {
        // Metadata only (spec S11): the system code, never the request.
        console.warn(`Google unreachable (${networkCode(error)}), attempt ${attempt}`);
        if (attempt === 1) {
          await sleep(LIMITS.connectRetryMs);
          continue;
        }
      }
      throw toUpstreamError(error);
    }
  }
}

export interface SynthesisResult {
  wav: Buffer;
}

export async function synthesize(request: TtsRequest, signal?: AbortSignal): Promise<SynthesisResult> {
  const interaction = await once(signal, (options) =>
    ai().interactions.create(
      {
        model: request.model,
        input: [
          {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text: request.text,
                ...(request.style ? { annotations: [{ type: 'speech_metadata' as const, style: request.style }] } : {}),
              },
            ],
          },
        ],
        // No `delivery` field: Google answers "Audio delivery mode is not supported" (tested 2026-10-27).
        response_format: { type: 'audio', mime_type: 'audio/wav' },
        generation_config: { speech_config: [{ voice: request.voice }] },
      },
      options,
    ),
  );

  const audio = interaction.output_audio;
  if (!audio?.data) throw new UpstreamError(502, 'NO_AUDIO', 'Google returned no audio for this text.');
  const bytes = Buffer.from(audio.data, 'base64');
  // Headerless PCM (audio/l16) gets a WAV header so every client receives the same format.
  if (audio.mime_type?.startsWith('audio/l16')) {
    return { wav: Buffer.from(encodeWavPcm16(bytes, audio.sample_rate ?? 24000, audio.channels ?? 1)) };
  }
  return { wav: bytes };
}

// ---------- Voices API (spec 4.7, 4.8) ----------

type VoiceOutput = Awaited<ReturnType<GoogleGenAI['voices']['get']>>;

function toSummary(voice: VoiceOutput): VoiceSummary {
  return {
    id: voice.id ?? voice.key ?? '',
    displayName: voice.display_name ?? voice.id ?? '',
    type: voice.type,
    gender: voice.gender,
    languageCode: voice.language_code,
    accent: voice.accent,
    description: voice.description,
    prompt: voice.prompted?.input,
    baseVoice: voice.prompted?.base_voice,
    expireTime: voice.expire_time,
    sampleWav: voice.sample_audio?.data,
  };
}

function designVoice(body: Extract<CreateVoiceBody, { type: 'prompted' }>, prompt: string, baseVoice: string | undefined) {
  return once(undefined, (options) =>
    ai().voices.create(
      {
        store: true,
        voice: {
          type: 'prompted',
          model: MODELS.tts[0],
          display_name: body.displayName,
          gender: body.gender,
          language_code: body.languageCode,
          prompted: { input: prompt, ...(baseVoice ? { base_voice: baseVoice } : {}) },
        },
      },
      options,
    ),
  );
}

/** Creates a stored voice. A refused remix falls back to a fresh design from the merged prompt. */
export async function createVoice(body: CreateVoiceBody): Promise<VoiceSummary> {
  if (body.type === 'replicated') {
    const voice = await once(undefined, (options) =>
      ai().voices.create(
        {
          store: true,
          voice: {
            type: 'replicated',
            model: MODELS.tts[0],
            display_name: body.displayName,
            language_code: body.languageCode,
            replicated: {
              source_audio: { mime_type: 'audio/wav', data: body.sourceWav },
              consent_audio: { mime_type: 'audio/wav', data: body.consentWav },
            },
          },
        },
        options,
      ),
    );
    return toSummary(voice);
  }
  try {
    return toSummary(await designVoice(body, body.prompt, body.baseVoice));
  } catch (error) {
    if (!body.baseVoice || !body.fallbackPrompt || !(error instanceof UpstreamError) || error.code !== 'BAD_REQUEST') throw error;
    return { ...toSummary(await designVoice(body, body.fallbackPrompt, undefined)), remixFallback: true };
  }
}

export async function listCustomVoices(): Promise<VoiceSummary[]> {
  const page = await once(undefined, (options) => ai().voices.list({ type: ['prompted', 'replicated'], page_size: 200 }, options));
  return (page.voices ?? []).map(toSummary).filter((v) => v.id);
}

export async function getVoice(id: string): Promise<VoiceSummary> {
  return toSummary(await once(undefined, (options) => ai().voices.get(id, undefined, options)));
}

export async function deleteVoice(id: string): Promise<void> {
  await once(undefined, (options) => ai().voices.delete(id, undefined, options));
}

/** Library probe for /api/capabilities: one cheap list call, no voice created. */
export async function probeLibrary(): Promise<'yes' | 'no'> {
  try {
    await once(undefined, (options) => ai().voices.list({ page_size: 1 }, options));
    return 'yes';
  } catch {
    return 'no';
  }
}
