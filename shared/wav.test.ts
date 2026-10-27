import { describe, expect, it } from 'vitest';
import { encodeWavPcm16, parseWav } from './wav.ts';

describe('wav', () => {
  it('round-trips a PCM16 mono buffer', () => {
    const pcm = new Uint8Array(48000); // 1 s at 24 kHz, 16-bit mono
    const info = parseWav(encodeWavPcm16(pcm, 24000));
    expect(info).toMatchObject({ audioFormat: 1, channels: 1, sampleRate: 24000, bitsPerSample: 16, dataOffset: 44, dataLength: 48000 });
    expect(info.durationSec).toBeCloseTo(1, 6);
  });

  it('skips extra chunks before data', () => {
    const base = encodeWavPcm16(new Uint8Array(4800), 24000);
    const list = new Uint8Array([0x4c, 0x49, 0x53, 0x54, 3, 0, 0, 0, 1, 2, 3, 0]); // "LIST", odd size + pad byte
    const withList = new Uint8Array(base.length + list.length);
    withList.set(base.subarray(0, 36));
    withList.set(list, 36);
    withList.set(base.subarray(36), 36 + list.length);
    const info = parseWav(withList);
    expect(info.dataOffset).toBe(44 + list.length);
    expect(info.durationSec).toBeCloseTo(0.1, 6);
  });

  it('falls back to the bytes present when the data size is unknown', () => {
    const wav = encodeWavPcm16(new Uint8Array(24000), 24000);
    new DataView(wav.buffer).setUint32(40, 0xffffffff, true);
    expect(parseWav(wav).durationSec).toBeCloseTo(0.5, 6);
  });

  it('measures a large file from its first bytes and its total size', () => {
    const wav = encodeWavPcm16(new Uint8Array(480000), 24000); // 10 s
    const info = parseWav(wav.subarray(0, 4096), wav.length);
    expect(info.dataOffset).toBe(44);
    expect(info.dataLength).toBe(480000);
    expect(info.durationSec).toBeCloseTo(10, 6);
  });

  it('rejects non-WAV input', () => {
    expect(() => parseWav(new TextEncoder().encode('MZ this is not audio'))).toThrow('Not a RIFF/WAVE file');
  });
});
