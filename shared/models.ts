// TTS models the app may call (spec section 2). The app runs on the Gemini API free tier:
// nothing is priced or capped locally; Google's own free-tier quotas apply.

export const TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'] as const;
export type TtsModel = (typeof TTS_MODELS)[number];

// Average French and English read speed, used only to show an expected duration.
const CHARS_PER_SECOND = 14;

export function estimateSpeechSeconds(text: string): number {
  return Math.max(1, text.trim().length / CHARS_PER_SECOND);
}
