import { describe, expect, it } from 'vitest';
import { encodeWavPcm16, parseWav } from '../../../shared/wav.ts';
import { assembleWav } from './assemble.ts';

const tone = (seconds: number, value: number) => {
  const pcm = new Uint8Array(seconds * 24000 * 2);
  const view = new DataView(pcm.buffer);
  for (let i = 0; i < pcm.length / 2; i++) view.setInt16(i * 2, value, true);
  return new Blob([encodeWavPcm16(pcm, 24000)], { type: 'audio/wav' });
};

describe('assembleWav', () => {
  it('joins segments and chapters with the requested silences', async () => {
    const { blob, seconds } = await assembleWav([[tone(1, 100), tone(2, 200)], [tone(1, 300)]], 500, 2000);
    expect(seconds).toBeCloseTo(1 + 0.5 + 2 + 2 + 1, 6);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const info = parseWav(bytes);
    expect(info.durationSec).toBeCloseTo(6.5, 6);
    const view = new DataView(bytes.buffer, info.dataOffset);
    const sampleAt = (sec: number) => view.getInt16(Math.round(sec * 24000) * 2, true);
    expect(sampleAt(0.5)).toBe(100);
    expect(sampleAt(1.25)).toBe(0); // gap between segments
    expect(sampleAt(2)).toBe(200);
    expect(sampleAt(4)).toBe(0); // gap between chapters
    expect(sampleAt(6)).toBe(300);
  });

  it('refuses segments with different formats', async () => {
    const other = new Blob([encodeWavPcm16(new Uint8Array(4800), 48000)], { type: 'audio/wav' });
    await expect(assembleWav([[tone(1, 1), other]], 0, 0)).rejects.toThrow('different formats');
  });
});
