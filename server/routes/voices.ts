// Voice Lab routes (spec 7.2): list, create (design, remix, clone), get, delete stored voices.
import express, { Router, type Response } from 'express';
import { CLONE_LIMITS } from '../../shared/consent.ts';
import { CreateVoiceSchema, StoredVoiceIdSchema, type CreateVoiceBody } from '../../shared/schemas.ts';
import { parseWav } from '../../shared/wav.ts';
import { capabilityState } from '../lib/capabilities.ts';
import { createVoice, deleteVoice, getVoice, hasKey, listCustomVoices, toUpstreamError } from '../lib/gemini.ts';
import { LIMITS } from '../config.ts';
import { RateLimiter } from '../lib/rateLimit.ts';
import type { UsageCounter } from '../lib/usage.ts';

function fail(res: Response, error: unknown) {
  const failure = toUpstreamError(error);
  if (!res.headersSent) res.status(failure.status).json(failure.toJSON());
}

function requireKey(res: Response): boolean {
  if (hasKey()) return true;
  res.status(503).json({ code: 'KEY_MISSING', message: 'No Gemini API key: add GEMINI_API_KEY to the .env file, then restart.' });
  return false;
}

/** Checks a base64 WAV is 24 kHz mono 16-bit and within the duration limits; returns an error message or null. */
function checkWav(base64: string, minSec: number, maxSec: number): string | null {
  try {
    const bytes = Buffer.from(base64, 'base64');
    const info = parseWav(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    if (info.sampleRate !== 24000 || info.channels !== 1 || info.bitsPerSample !== 16) return 'Audio must be 24 kHz mono 16-bit WAV.';
    if (info.durationSec < minSec || info.durationSec > maxSec + 0.5) return `Audio must last between ${minSec} and ${maxSec} seconds.`;
    return null;
  } catch {
    return 'Audio is not a valid WAV file.';
  }
}

export function voiceRoutes(usage: UsageCounter): Router {
  const router = Router();
  const limiter = new RateLimiter(LIMITS.voiceCreationsPerMinute);

  router.get('/voices', async (_req, res) => {
    if (!requireKey(res)) return;
    try {
      res.set('Cache-Control', 'no-store').json({ voices: await listCustomVoices() });
    } catch (error) {
      fail(res, error);
    }
  });

  router.get('/voices/:id', async (req, res) => {
    const id = StoredVoiceIdSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'Invalid voice id.' });
      return;
    }
    if (!requireKey(res)) return;
    try {
      res.set('Cache-Control', 'no-store').json(await getVoice(id.data));
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete('/voices/:id', async (req, res) => {
    const id = StoredVoiceIdSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'Invalid voice id.' });
      return;
    }
    if (!requireKey(res)) return;
    try {
      await deleteVoice(id.data);
      res.status(204).end();
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/voices', express.json({ limit: '6mb' }), async (req, res) => {
    const parsed = CreateVoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'Invalid voice request.', detail: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    const body: CreateVoiceBody = parsed.data;
    if (body.type === 'replicated') {
      const problem =
        checkWav(body.sourceWav, CLONE_LIMITS.minSourceSec, CLONE_LIMITS.maxSourceSec) ??
        checkWav(body.consentWav, CLONE_LIMITS.minConsentSec, CLONE_LIMITS.maxConsentSec);
      if (problem) {
        res.status(400).json({ code: 'INVALID_AUDIO', message: problem });
        return;
      }
    }
    if (!requireKey(res)) return;
    if (!limiter.take()) {
      res.status(429).json({ code: 'RATE_MINUTE', message: 'Local safety limit reached.' });
      return;
    }

    const kind = body.type === 'prompted' ? 'voiceDesign' : 'replication';
    try {
      usage.count();
      const voice = await createVoice(body);
      capabilityState[kind] = 'yes';
      res.status(201).json(voice);
    } catch (error) {
      const failure = toUpstreamError(error);
      if (failure.code === 'FORBIDDEN') capabilityState[kind] = 'no';
      fail(res, failure);
    }
  });

  return router;
}
