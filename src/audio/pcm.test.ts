import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, floatToPcm16, judgeLevels, levelStats } from './pcm.ts';

describe('pcm', () => {
  it('converts floats to clamped 16-bit little-endian PCM', () => {
    const bytes = floatToPcm16(new Float32Array([0, 1, -1, 2, 0.5]));
    const view = new DataView(bytes.buffer);
    expect([0, 1, 2, 3, 4].map((i) => view.getInt16(i * 2, true))).toEqual([0, 32767, -32768, 32767, 16384]);
  });

  it('measures peak, RMS and clipping', () => {
    const full = levelStats(new Float32Array([1, -1, 1, -1]));
    expect(full.peakDb).toBeCloseTo(0, 6);
    expect(full.rmsDb).toBeCloseTo(0, 6);
    expect(full.clippingRatio).toBe(1);
    const half = levelStats(new Float32Array([0.5, -0.5]));
    expect(half.peakDb).toBeCloseTo(-6.02, 2);
    expect(levelStats(new Float32Array(10)).rmsDb).toBe(-Infinity);
  });

  it('judges a reference level', () => {
    expect(judgeLevels({ peakDb: -3, rmsDb: -20, clippingRatio: 0 })).toBe('ok');
    expect(judgeLevels({ peakDb: 0, rmsDb: -12, clippingRatio: 0.01 })).toBe('clipping');
    expect(judgeLevels({ peakDb: -30, rmsDb: -40, clippingRatio: 0 })).toBe('quiet');
    expect(judgeLevels({ peakDb: -80, rmsDb: -70, clippingRatio: 0 })).toBe('silent');
  });

  it('round-trips base64 for large buffers', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});
