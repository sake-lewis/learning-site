import express, { Router } from 'express';
import { TtsRequestSchema } from '../../shared/schemas.ts';
import { parseWav } from '../../shared/wav.ts';
import { LIMITS } from '../config.ts';
import { ResultCache } from '../lib/cache.ts';
import { hasKey, synthesize, toUpstreamError } from '../lib/gemini.ts';
import { RateLimiter } from '../lib/rateLimit.ts';
import type { UsageCounter } from '../lib/usage.ts';

const SHORT_TEXT_CHARS = 1500;

interface CachedAudio {
  wav: Buffer;
  seconds: number;
}

export function ttsRoutes(usage: UsageCounter): Router {
  const router = Router();
  const limiter = new RateLimiter(LIMITS.ttsPerMinute);
  const cache = new ResultCache<CachedAudio>(LIMITS.cacheTtlMs, LIMITS.cacheMaxBytes);

  router.post('/tts', express.json({ limit: '64kb' }), async (req, res) => {
    const parsed = TtsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'Invalid text, style, voice or model.', detail: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    const request = parsed.data;
    const key = ResultCache.key([request.model, request.voice, request.style, request.text]);

    const send = (audio: CachedAudio, cached: boolean) => {
      res
        .status(200)
        .set({
          'Content-Type': 'audio/wav',
          'Cache-Control': 'no-store',
          'X-Audio-Seconds': audio.seconds.toFixed(3),
          'X-Cache': cached ? 'hit' : 'miss',
        })
        .send(audio.wav);
    };

    // An identical request within 10 minutes (double click, replay) does not spend free-tier quota.
    const hit = cache.get(key);
    if (hit) return send(hit, true);

    if (!hasKey()) {
      res.status(503).json({ code: 'KEY_MISSING', message: 'No Gemini API key: add GEMINI_API_KEY to the .env file, then restart.' });
      return;
    }
    if (!limiter.take()) {
      res.status(429).json({ code: 'RATE_MINUTE', message: 'Local safety limit reached.' });
      return;
    }

    // Abort the upstream call if the browser cancels (Esc) or disconnects.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });

    try {
      usage.count();
      const { wav } = await synthesize(request, abort.signal);
      const seconds = parseWav(new Uint8Array(wav.buffer, wav.byteOffset, wav.byteLength)).durationSec;
      const audio = { wav, seconds };
      // Only short texts are worth keeping (double clicks, previews); audiobook segments are never replayed.
      if (request.text.length <= SHORT_TEXT_CHARS) cache.set(key, audio, wav.byteLength);
      send(audio, false);
    } catch (error) {
      const failure = toUpstreamError(error);
      if (res.headersSent || abort.signal.aborted) return;
      res.status(failure.status).json(failure.toJSON());
    }
  });

  return router;
}
