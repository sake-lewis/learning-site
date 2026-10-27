// Browser audio capture and conversion for the cloning flow: microphone recording with voice
// processing off (spec 4.1) and conversion of any decodable clip to 24 kHz mono 16-bit WAV.
import { UPLOAD_LIMITS } from '../../shared/consent.ts';
import { encodeWavPcm16 } from '../../shared/wav.ts';
import { floatToPcm16, levelStats, type LevelStats } from './pcm.ts';

const TARGET_RATE = 24000;
const METADATA_TIMEOUT_MS = 5000;

export type UploadProblem = 'tooBig' | 'tooLong';

/** Spec S6 caps for an imported clip. `seconds` is NaN or Infinity when the browser could not tell. */
export function uploadProblem(bytes: number, seconds: number): UploadProblem | null {
  if (bytes > UPLOAD_LIMITS.maxBytes) return 'tooBig';
  if (Number.isFinite(seconds) && seconds > UPLOAD_LIMITS.maxSec) return 'tooLong';
  return null;
}

/** Duration from the file's metadata, without decoding the audio; NaN when the browser cannot tell. */
export function mediaDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    let timer = 0;
    const done = (seconds: number) => {
      window.clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    timer = window.setTimeout(() => done(Number.NaN), METADATA_TIMEOUT_MS);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(Number.NaN);
    audio.src = url;
  });
}

export interface PreparedClip {
  wav: Uint8Array<ArrayBuffer>;
  seconds: number;
  stats: LevelStats;
  trimmed: boolean;
}

/** Decodes a clip, mixes it to mono, resamples to 24 kHz and keeps at most `maxSeconds`. */
export async function prepareClip(blob: Blob, maxSeconds: number): Promise<PreparedClip> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const seconds = Math.min(decoded.duration, maxSeconds);
    const offline = new OfflineAudioContext(1, Math.ceil(seconds * TARGET_RATE), TARGET_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0, 0, seconds);
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    return {
      wav: encodeWavPcm16(floatToPcm16(samples), TARGET_RATE, 1),
      seconds: rendered.duration,
      stats: levelStats(samples),
      trimmed: decoded.duration > maxSeconds + 0.05,
    };
  } finally {
    void context.close();
  }
}

export interface Recording {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

/** Starts a microphone recording with echo cancellation, noise suppression and auto gain off. */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const release = () => stream.getTracks().forEach((track) => track.stop());
  recorder.start();
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = release;
      if (recorder.state !== 'inactive') recorder.stop();
      else release();
    },
  };
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
