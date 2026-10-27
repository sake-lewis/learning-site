import { TTS_MODELS } from '../shared/models.ts';

export const HOST = '127.0.0.1';
export const PORT = Number(process.env.PORT ?? 5178);
export const DEV = process.env.TIMBRE_DEV === '1';
const DEV_CLIENT_PORT = 5173;

export const SDK_VERSION = '2.31.0';

export const MODELS = {
  tts: TTS_MODELS,
  analysis: 'gemini-3.8-flash',
  transcribe: 'gemini-3.5-transcribe',
} as const;

export const LIMITS = {
  // Anti-runaway guard only (a stuck loop in the page): far above Google's free-tier pace, no daily cap.
  ttsPerMinute: 30,
  voiceCreationsPerMinute: 10,
  cacheTtlMs: 10 * 60 * 1000,
  cacheMaxBytes: 200 * 1024 * 1024,
  // An audiobook segment of ~3,500 characters is about 4 minutes of audio: allow Google time to render it.
  upstreamTimeoutMs: 300_000,
};

export const ALLOWED_HOSTS = [`127.0.0.1:${PORT}`, `localhost:${PORT}`];

export const ALLOWED_ORIGINS = [
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`,
  ...(DEV ? [`http://127.0.0.1:${DEV_CLIENT_PORT}`, `http://localhost:${DEV_CLIENT_PORT}`] : []),
];
