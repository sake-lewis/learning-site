import { Router } from 'express';
import type { Capabilities, Health } from '../../shared/schemas.ts';
import { LIMITS, MODELS, SDK_VERSION } from '../config.ts';
import { capabilityState } from '../lib/capabilities.ts';
import { hasKey, probeLibrary } from '../lib/gemini.ts';
import type { UsageCounter } from '../lib/usage.ts';

const PROBE_TTL_MS = 10 * 60 * 1000;

export function systemRoutes(sessionToken: string, usage: UsageCounter): Router {
  const router = Router();
  let probe: { at: number; library: 'yes' | 'no' } | null = null;

  router.get('/session', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ token: sessionToken });
  });

  router.get('/health', (_req, res) => {
    const body: Health = {
      ok: true,
      keyPresent: hasKey(),
      sdkVersion: SDK_VERSION,
      models: { tts: [...MODELS.tts], analysis: MODELS.analysis, transcribe: MODELS.transcribe },
      usage: usage.snapshot(),
      limits: { ttsPerMinute: LIMITS.ttsPerMinute },
    };
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.get('/capabilities', async (_req, res) => {
    const keyPresent = hasKey();
    if (keyPresent && (!probe || Date.now() - probe.at > PROBE_TTL_MS)) {
      probe = { at: Date.now(), library: await probeLibrary() };
    }
    // Voice design and replication can only be confirmed by creating a voice: they stay
    // "unknown" until the user's first attempt, so the probe never spends quota.
    const body: Capabilities = {
      tts: keyPresent,
      library: keyPresent && probe ? probe.library : 'unknown',
      voiceDesign: capabilityState.voiceDesign,
      replication: capabilityState.replication,
    };
    res.set('Cache-Control', 'no-store').json(body);
  });

  return router;
}
