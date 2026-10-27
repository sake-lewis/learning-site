// Minimal RIFF/WAVE reader and PCM16 writer, shared by the server and the browser.

export interface WavInfo {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
  durationSec: number;
}

function ascii(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
}

/**
 * Reads a WAV header. `bytes` may be only the start of the file (e.g. its first 4 KB) when
 * `totalLength` gives the full file size, so large clips need not be loaded to be measured.
 */
export function parseWav(bytes: Uint8Array, totalLength: number = bytes.length): WavInfo {
  if (bytes.length < 12 || ascii(bytes, 0) !== 'RIFF' || ascii(bytes, 8) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let fmt: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;

  while (offset + 8 <= Math.min(bytes.length, totalLength)) {
    const id = ascii(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === 'fmt ') {
      fmt = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      if (!fmt) throw new Error('WAV data chunk before fmt chunk');
      // Streamed WAVs may carry 0 or 0xFFFFFFFF as size: fall back to the bytes actually present.
      const available = totalLength - body;
      const dataLength = size === 0 || size === 0xffffffff || size > available ? available : size;
      const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
      return { ...fmt, dataOffset: body, dataLength, durationSec: bytesPerSecond > 0 ? dataLength / bytesPerSecond : 0 };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV file has no data chunk');
}

/** The 44-byte header of a PCM16 WAV whose sample data is `dataLength` bytes long. */
export function wavHeader(dataLength: number, sampleRate: number, channels = 1): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(44);
  const view = new DataView(out.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) out[offset + i] = text.charCodeAt(i);
  };
  const blockAlign = channels * 2;
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataLength, true);
  return out;
}

export function encodeWavPcm16(pcm: Uint8Array, sampleRate: number, channels = 1): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(44 + pcm.length);
  out.set(wavHeader(pcm.length, sampleRate, channels));
  out.set(pcm, 44);
  return out;
}
