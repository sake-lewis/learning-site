import { z } from 'zod';
import { CONSENT_LOCALES } from './consent.ts';
import { TTS_MODELS } from './models.ts';
import { PREBUILT_VOICE_NAMES } from './voices.ts';

export const MAX_TEXT_CHARS = 8000;
// Direction (`style`): long enough for scene context (user decision 2026-10-27); the UI warns that
// very long directions can make the voice drift.
export const MAX_STYLE_CHARS = 1500;
export const MAX_PROMPT_CHARS = 1500;
export const MAX_VOICE_NAME_CHARS = 60;

const CustomVoiceId = z.string().regex(/^voice(key)?_[A-Za-z0-9_-]{1,200}$/);
export const StoredVoiceIdSchema = z.string().regex(/^voice_[A-Za-z0-9_-]{1,200}$/);

export const TtsRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_CHARS),
  style: z.string().trim().max(MAX_STYLE_CHARS).default(''),
  voice: z.union([z.enum(PREBUILT_VOICE_NAMES), CustomVoiceId]),
  model: z.enum(TTS_MODELS),
});
export type TtsRequest = z.infer<typeof TtsRequestSchema>;

export const SessionSchema = z.object({ token: z.string().min(20).max(200) });

export const HealthSchema = z.object({
  ok: z.literal(true),
  keyPresent: z.boolean(),
  sdkVersion: z.string(),
  models: z.object({
    tts: z.array(z.string()),
    analysis: z.string(),
    transcribe: z.string(),
  }),
  usage: z.object({
    date: z.string(),
    calls: z.number(),
  }),
  limits: z.object({
    ttsPerMinute: z.number(),
  }),
});
export type Health = z.infer<typeof HealthSchema>;

const Tri = z.enum(['yes', 'no', 'unknown']);
export const CapabilitiesSchema = z.object({
  tts: z.boolean(),
  library: Tri,
  voiceDesign: Tri,
  replication: Tri,
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

// ---------- Voice Lab (spec 4.7, 4.8) ----------

export const VOICE_GENDERS = ['female', 'male', 'neutral'] as const;
export type VoiceGender = (typeof VOICE_GENDERS)[number];

const LanguageCode = z.string().regex(/^[a-z]{2,3}-([A-Z]{2}|[0-9]{3})$/);
const DisplayName = z.string().trim().min(1).max(MAX_VOICE_NAME_CHARS);
// 30 s of 24 kHz mono 16-bit WAV is about 1.44 MB; base64 adds a third.
const Base64Wav = z
  .string()
  .max(2_700_000)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);

export const DesignVoiceSchema = z.object({
  type: z.literal('prompted'),
  displayName: DisplayName,
  gender: z.enum(VOICE_GENDERS),
  languageCode: LanguageCode,
  prompt: z.string().trim().min(3).max(MAX_PROMPT_CHARS),
  /** Remix: the prompt then describes only the change to this voice. */
  baseVoice: z.union([z.enum(PREBUILT_VOICE_NAMES), StoredVoiceIdSchema]).optional(),
  /** Full description used if Google refuses the remix. */
  fallbackPrompt: z.string().trim().min(10).max(MAX_PROMPT_CHARS * 2).optional(),
});

export const CloneVoiceSchema = z.object({
  type: z.literal('replicated'),
  displayName: DisplayName,
  languageCode: z.enum(CONSENT_LOCALES),
  sourceWav: Base64Wav,
  consentWav: Base64Wav,
});

export const CreateVoiceSchema = z.discriminatedUnion('type', [DesignVoiceSchema, CloneVoiceSchema]);
export type CreateVoiceBody = z.infer<typeof CreateVoiceSchema>;

export const VoiceSummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  type: z.string(),
  gender: z.string().optional(),
  languageCode: z.string().optional(),
  accent: z.string().optional(),
  description: z.string().optional(),
  prompt: z.string().optional(),
  baseVoice: z.string().optional(),
  expireTime: z.string().optional(),
  sampleWav: z.string().optional(),
  remixFallback: z.boolean().optional(),
});
export type VoiceSummary = z.infer<typeof VoiceSummarySchema>;

export const VoiceListSchema = z.object({ voices: z.array(VoiceSummarySchema) });

/** Which free-tier quota Google says ran out: a per-minute one can be waited out, a per-day one cannot. */
export const QUOTA_SCOPES = ['day', 'minute', 'unknown'] as const;
export type QuotaScope = (typeof QUOTA_SCOPES)[number];

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  detail: z.string().optional(),
  scope: z.enum(QUOTA_SCOPES).optional(),
  retryAfterSec: z.number().optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
