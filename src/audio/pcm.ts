// Pure PCM helpers used by the cloning flow (spec 4.1, 4.7). No browser APIs, so they are unit-tested.

/** Float samples in [-1, 1] to little-endian signed 16-bit PCM bytes. */
export function floatToPcm16(samples: Float32Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }
  return out;
}

export interface LevelStats {
  peakDb: number;
  rmsDb: number;
  clippingRatio: number;
}

const toDb = (value: number) => (value > 0 ? 20 * Math.log10(value) : -Infinity);

export function levelStats(samples: Float32Array): LevelStats {
  let peak = 0;
  let sumSquares = 0;
  let clipped = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i] ?? 0);
    if (v > peak) peak = v;
    if (v >= 0.999) clipped++;
    sumSquares += v * v;
  }
  const rms = samples.length > 0 ? Math.sqrt(sumSquares / samples.length) : 0;
  return { peakDb: toDb(peak), rmsDb: toDb(rms), clippingRatio: samples.length > 0 ? clipped / samples.length : 0 };
}

export type LevelVerdict = 'ok' | 'quiet' | 'clipping' | 'silent';

/** Simplified quality gate for a cloning reference (the full gate of 4.1 arrives with Voice Match). */
export function judgeLevels(stats: LevelStats): LevelVerdict {
  if (stats.rmsDb < -55) return 'silent';
  if (stats.clippingRatio > 0.001) return 'clipping';
  if (stats.rmsDb < -35) return 'quiet';
  return 'ok';
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
