import { describe, expect, it } from 'vitest';
import { MAX_STYLE_CHARS, TtsRequestSchema } from './schemas.ts';

const request = (style: string) => ({ text: 'Bonjour.', style, voice: 'Kore', model: 'gemini-3.8-flash-tts' });

describe('TtsRequestSchema', () => {
  it('accepts a direction of up to 1,500 characters, line breaks included', () => {
    expect(MAX_STYLE_CHARS).toBe(1500);
    const long = 'Scène de nuit, voix basse et tendue.\n'.repeat(50).slice(0, MAX_STYLE_CHARS);
    expect(long).toHaveLength(MAX_STYLE_CHARS);
    expect(TtsRequestSchema.safeParse(request(long)).success).toBe(true);
  });

  it('rejects a longer direction', () => {
    expect(TtsRequestSchema.safeParse(request('a'.repeat(MAX_STYLE_CHARS + 1))).success).toBe(false);
  });
});
