// The console strip (spec 6.1, DESIGN.md): transport, voice, waveform, timecode, download.
// Space toggles playback; Ctrl+Shift+E downloads the loaded clip.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { parseWav } from '../../../shared/wav.ts';
import { downloadBlob, formatClock } from '../../app/format.ts';
import { useT } from '../../app/i18n.ts';
import { usePlayer } from '../../app/stores.ts';
import { DownloadIcon, PauseIcon, PlayIcon } from '../icons.tsx';
import { BrandMark } from './Brand.tsx';
import { VoiceOrb } from './VoiceOrb.tsx';

const BUCKETS = 400;

// Above this size (about 12 minutes of 24 kHz mono) the waveform is skipped: reading the whole file
// on the main thread would freeze the page. Playback and download are unaffected.
const MAX_WAVEFORM_BYTES = 36 * 1024 * 1024;

/** Peak per bucket, normalised to the loudest bucket, read straight from 16-bit PCM. */
async function computePeaks(blob: Blob): Promise<Float32Array> {
  if (blob.size > MAX_WAVEFORM_BYTES) return new Float32Array(BUCKETS).fill(0.35);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const info = parseWav(bytes);
  if (info.bitsPerSample !== 16) return new Float32Array(BUCKETS).fill(0.5);
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset + info.dataOffset, Math.floor(info.dataLength / 2));
  const frames = Math.floor(samples.length / info.channels);
  const size = Math.max(1, Math.floor(frames / BUCKETS));
  const peaks = new Float32Array(BUCKETS);
  let loudest = 1;
  for (let b = 0; b < BUCKETS; b++) {
    let max = 0;
    const end = Math.min(frames, (b + 1) * size);
    for (let f = b * size; f < end; f++) {
      const v = Math.abs(samples[f * info.channels] ?? 0);
      if (v > max) max = v;
    }
    peaks[b] = max;
    if (max > loudest) loudest = max;
  }
  for (let b = 0; b < BUCKETS; b++) peaks[b] = (peaks[b] ?? 0) / loudest;
  return peaks;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName);
}

/** Waveform colours from the design tokens, read once rather than on every animation frame. */
function useWaveColors(): { played: string; rest: string } {
  const [colors, setColors] = useState({ played: '#f2b544', rest: '#3a3631' });
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    setColors({ played: css.getPropertyValue('--accent').trim() || '#f2b544', rest: css.getPropertyValue('--wave').trim() || '#3a3631' });
  }, []);
  return colors;
}

export function Player() {
  const t = useT();
  const clip = usePlayer((s) => s.clip);
  const autoplayId = usePlayer((s) => s.autoplayId);
  const colors = useWaveColors();
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const hasClip = clip !== null;

  useEffect(() => {
    setTime(0);
    setPlaying(false);
    setDuration(clip?.seconds ?? 0);
    if (!clip) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(clip.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [clip]);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);
    if (clip) {
      computePeaks(clip.blob)
        .then((p) => !cancelled && setPeaks(p))
        .catch(() => !cancelled && setPeaks(null));
    }
    return () => {
      cancelled = true;
    };
  }, [clip]);

  useEffect(() => {
    if (url && clip && autoplayId === clip.id) void audioRef.current?.play().catch(() => undefined);
  }, [url, clip, autoplayId]);

  // Smooth progress while playing; timeupdate alone fires only about 4 times a second.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      setTime(audioRef.current?.currentTime ?? 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  // Redraw when the strip changes width (window resize, zoom, drawer), not only when playback moves.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => setCanvasWidth(entry?.contentRect.width ?? 0));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [hasClip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const bar = 2.5 * ratio;
    const gap = 1.75 * ratio;
    const count = Math.floor(width / (bar + gap));
    const progress = duration > 0 ? time / duration : 0;
    for (let i = 0; i < count; i++) {
      const peak = peaks ? (peaks[Math.floor((i / count) * peaks.length)] ?? 0) : 0.06;
      const h = Math.max(3 * ratio, Math.pow(peak, 0.8) * (height - 2 * ratio));
      ctx.fillStyle = i / count <= progress ? colors.played : colors.rest;
      ctx.beginPath();
      ctx.roundRect(i * (bar + gap), (height - h) / 2, bar, h, bar / 2);
      ctx.fill();
    }
  }, [peaks, time, duration, colors, canvasWidth]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [url]);

  const download = useCallback(() => {
    if (clip) downloadBlob(clip.blob, clip.fileName);
  }, [clip]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === ' ' && !isTyping(event.target)) {
        event.preventDefault();
        toggle();
      } else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        download();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, download]);

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || duration <= 0) return;
    audio.currentTime = Math.min(duration, Math.max(0, seconds));
    setTime(audio.currentTime);
  };

  const onWaveKey = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -5, ArrowRight: 5 };
    if (event.key in steps) {
      event.preventDefault();
      seekTo(time + (steps[event.key] ?? 0));
    } else if (event.key === 'Home') seekTo(0);
    else if (event.key === 'End') seekTo(duration);
  };

  if (!clip) {
    return (
      <footer className="player">
        <p className="player-empty">
          <BrandMark size={28} />
          {t('player.empty')}
        </p>
      </footer>
    );
  }

  return (
    <footer className="player">
      <audio
        ref={audioRef}
        src={url ?? undefined}
        preload="auto"
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(duration);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
      />
      <button type="button" className="transport" onClick={toggle} aria-label={playing ? t('player.pause') : t('player.play')}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="player-info">
        <VoiceOrb seed={clip.seed ?? clip.title} size={36} />
        <div className="player-text">
          <div className="player-title" title={clip.title}>
            {clip.title}
          </div>
          {clip.subtitle && (
            <div className="player-sub" title={clip.subtitle}>
              {clip.subtitle}
            </div>
          )}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="wave"
        role="slider"
        tabIndex={0}
        aria-label={t('player.seek')}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${formatClock(time)} / ${formatClock(duration)}`}
        onKeyDown={onWaveKey}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seekTo(((e.clientX - rect.left) / rect.width) * duration);
        }}
      />
      <span className="player-time timecode">
        {formatClock(time)} / {formatClock(duration)}
      </span>
      <button type="button" className="btn btn-ghost btn-icon" onClick={download} aria-label={t('player.download')} title={`${t('player.download')} (Ctrl+Shift+E)`}>
        <DownloadIcon />
      </button>
    </footer>
  );
}
