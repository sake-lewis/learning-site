// Joins segment WAVs into one chapter or book file without copying the audio: the result is a Blob
// made of a new header, slices of the stored segments, and shared silence buffers.
import { parseWav, wavHeader } from '../../../shared/wav.ts';

const HEADER_PROBE_BYTES = 4096;

export interface Assembled {
  blob: Blob;
  seconds: number;
}

/** `groups` are chapters of segment WAVs; segments are separated by `segmentGapMs`, chapters by `groupGapMs`. */
export async function assembleWav(groups: Blob[][], segmentGapMs: number, groupGapMs: number): Promise<Assembled> {
  let format: { sampleRate: number; channels: number } | null = null;
  const parts: BlobPart[] = [];
  let dataLength = 0;
  const silences = new Map<number, Uint8Array<ArrayBuffer>>();

  const silence = (ms: number) => {
    if (!format || ms <= 0) return;
    const bytes = Math.round((format.sampleRate * ms) / 1000) * format.channels * 2;
    let buffer = silences.get(bytes);
    if (!buffer) {
      buffer = new Uint8Array(bytes);
      silences.set(bytes, buffer);
    }
    parts.push(buffer);
    dataLength += bytes;
  };

  for (const [g, group] of groups.entries()) {
    if (g > 0) silence(groupGapMs);
    for (const [s, wav] of group.entries()) {
      const info = parseWav(new Uint8Array(await wav.slice(0, HEADER_PROBE_BYTES).arrayBuffer()), wav.size);
      if (info.bitsPerSample !== 16 || info.audioFormat !== 1) throw new Error('Unsupported WAV format');
      if (!format) format = { sampleRate: info.sampleRate, channels: info.channels };
      else if (format.sampleRate !== info.sampleRate || format.channels !== info.channels) throw new Error('Segments have different formats');
      if (s > 0) silence(segmentGapMs);
      parts.push(wav.slice(info.dataOffset, info.dataOffset + info.dataLength));
      dataLength += info.dataLength;
    }
  }
  if (!format) throw new Error('Nothing to assemble');
  const bytesPerSecond = format.sampleRate * format.channels * 2;
  return {
    blob: new Blob([wavHeader(dataLength, format.sampleRate, format.channels), ...parts], { type: 'audio/wav' }),
    seconds: dataLength / bytesPerSecond,
  };
}
