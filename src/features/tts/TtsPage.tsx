// Text to Speech page: one script, one segment, generate / play / download (F1, F12, F13).
import { useCallback, useEffect, useRef, useState } from 'react';
import { estimateSpeechSeconds } from '../../../shared/models.ts';
import { MAX_TEXT_CHARS } from '../../../shared/schemas.ts';
import { ApiError, synthesize } from '../../app/api.ts';
import { audioFileName, downloadBlob, formatDuration } from '../../app/format.ts';
import { errorText } from '../../app/errors.ts';
import { RETENTION_DAYS } from '../../app/retention.ts';
import { useT } from '../../app/i18n.ts';
import { useSettings } from '../../app/settings.ts';
import { useConnection, useDraft, usePlayer, useToasts } from '../../app/stores.ts';
import { useVoices, voiceLabel } from '../../app/voices.ts';
import { db, type HistoryEntry } from '../../db/schema.ts';
import { PREBUILT_VOICES } from '../../../shared/voices.ts';
import { EqLoader } from '../../ui/components/Brand.tsx';
import { VoiceOrb } from '../../ui/components/VoiceOrb.tsx';
import { DownloadIcon, PlayIcon, SlidersIcon, TrashIcon } from '../../ui/icons.tsx';
import { Inspector, VOICE_LIST_ID } from './Inspector.tsx';
import { SAMPLES } from './samples.ts';

const RECENT_PAGE = 10;

export function TtsPage() {
  const t = useT();
  const { lang, model, voice, style } = useSettings();
  const text = useDraft((s) => s.text);
  const setText = useDraft((s) => s.setText);
  const keyPresent = useConnection((s) => s.keyPresent);
  const presets = useVoices((s) => s.presets);
  const voiceName = voiceLabel(voice, presets);
  const loadClip = usePlayer((s) => s.load);
  const toast = useToasts((s) => s.push);
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  // Every stored generation can be reached: "Show more" loads the next page of older ones.
  const [recentLimit, setRecentLimit] = useState(RECENT_PAGE);
  const [recentTotal, setRecentTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = text.trim();
  const over = text.length > MAX_TEXT_CHARS;
  const seconds = estimateSpeechSeconds(trimmed);
  const canGenerate = !busy && trimmed.length > 0 && !over && keyPresent !== false;

  const refreshRecent = useCallback(async () => {
    try {
      const [rows, total] = await Promise.all([db.history.orderBy('createdAt').reverse().limit(recentLimit).toArray(), db.history.count()]);
      setRecent(rows);
      setRecentTotal(total);
    } catch {
      setRecent([]);
      setRecentTotal(0);
    }
  }, [recentLimit]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const result = await synthesize({ text: trimmed, style: style.trim(), voice, model }, controller.signal);
      const now = Date.now();
      const takeId = crypto.randomUUID();
      const durationMs = Math.round(result.seconds * 1000);
      loadClip({ id: takeId, blob: result.blob, title: voiceName, subtitle: trimmed.slice(0, 120), seed: voice, fileName: audioFileName(voiceName, now), seconds: result.seconds }, true);
      toast(result.cached ? 'info' : 'success', result.cached ? t('toast.cached') : t('toast.generated', { duration: formatDuration(result.seconds) }));
      try {
        await db.transaction('rw', db.takes, db.history, async () => {
          await db.takes.add({ id: takeId, segmentId: null, wav: result.blob, durationMs, wer: null, judgeScore: null, flags: [], model, voiceId: voice, createdAt: now });
          await db.history.add({
            id: crypto.randomUUID(),
            projectId: null,
            takeId,
            textPreview: trimmed.slice(0, 160),
            voiceId: voice,
            style: style.trim(),
            model,
            durationMs,
            qa: null,
            createdAt: now,
          });
        });
        await refreshRecent();
      } catch {
        // Storage full or blocked: the clip still plays and downloads from the player.
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CANCELLED') toast('info', t('toast.cancelled'));
      else toast('error', errorText(t, error));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [canGenerate, trimmed, style, voice, voiceName, model, loadClip, toast, t, refreshRecent]);

  // Ctrl+Enter generates, Esc cancels or closes the drawer (spec 6.3).
  const generateRef = useRef(generate);
  generateRef.current = generate;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        void generateRef.current();
      } else if (event.key === 'Escape') {
        if (abortRef.current) abortRef.current.abort();
        else setDrawer(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openEntry = async (entry: HistoryEntry, action: 'play' | 'download') => {
    const take = await db.takes.get(entry.takeId);
    if (!take) return;
    const name = voiceLabel(entry.voiceId, presets);
    const fileName = audioFileName(name, entry.createdAt);
    if (action === 'download') downloadBlob(take.wav, fileName);
    else loadClip({ id: take.id, blob: take.wav, title: name, subtitle: entry.textPreview, seed: entry.voiceId, fileName, seconds: entry.durationMs / 1000 }, true);
  };

  const deleteEntry = async (entry: HistoryEntry) => {
    await db.transaction('rw', db.takes, db.history, async () => {
      await db.takes.delete(entry.takeId);
      await db.history.delete(entry.id);
    });
    toast('info', t('toast.deleted'));
    await refreshRecent();
  };

  const prebuilt = PREBUILT_VOICES.find((v) => v.name === voice);
  const voiceDetail = prebuilt?.descriptor ?? presets.find((p) => p.voiceId === voice)?.accent ?? '';

  /** The voice chip opens the drawer on narrow screens and jumps to the voice list otherwise. */
  const showVoices = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setDrawer(true);
      return;
    }
    const list = document.getElementById(VOICE_LIST_ID);
    list?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    list?.focus({ preventScroll: true });
  };

  return (
    <div className="tts">
      <section className="editor-col">
        <div className="editor-wrap">
          <header className="page-head">
            <div>
              <h1>{t('tts.title')}</h1>
              <p className="page-sub">{t('tts.subtitle')}</p>
            </div>
            <button type="button" className="voice-chip" onClick={showVoices} aria-label={`${t('inspector.voice')} : ${voiceName}`}>
              <VoiceOrb seed={voice} size={30} />
              <span>
                {voiceName} {voiceDetail && <small>{voiceDetail}</small>}
              </span>
              <SlidersIcon />
            </button>
          </header>

          {keyPresent === false && (
            <div className="notice" role="alert">
              {t('tts.keyMissing')}
            </div>
          )}

          <div className="composer">
            <div className="composer-bar">
              <span>{t('tts.samples')}</span>
              <button type="button" className="chip" onClick={() => setText(SAMPLES.fr)}>
                {t('tts.sample.fr')}
              </button>
              <button type="button" className="chip" onClick={() => setText(SAMPLES.en)}>
                {t('tts.sample.en')}
              </button>
            </div>
            <label htmlFor="script" className="visually-hidden">
              {t('tts.title')}
            </label>
            <textarea id="script" className="editor" value={text} placeholder={t('tts.placeholder')} onChange={(e) => setText(e.target.value)} spellCheck lang={lang} />
            <div className="composer-foot">
              <div className="meta-list">
                <span className={`meta${over ? ' over' : ''}`}>{t('tts.chars', { n: text.length.toLocaleString(lang), max: MAX_TEXT_CHARS.toLocaleString(lang) })}</span>
                {trimmed.length > 0 && <span className="meta">{t('tts.estimate', { duration: formatDuration(seconds) })}</span>}
              </div>
              <div className="row-actions">
                {busy && (
                  <button type="button" className="btn btn-ghost" onClick={() => abortRef.current?.abort()}>
                    {t('tts.cancel')} <kbd>Esc</kbd>
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-lg" disabled={!canGenerate} onClick={() => void generate()}>
                  {busy ? (
                    <>
                      <EqLoader /> {t('tts.generating')}
                    </>
                  ) : (
                    <>
                      {t('tts.generate')} <kbd>Ctrl ↵</kbd>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <section className="stack" aria-labelledby="recent-title">
            <h2 id="recent-title" className="section-title">
              {t('recent.title')}
            </h2>
            {recent.length === 0 ? (
              <p className="empty">{t('recent.empty')}</p>
            ) : (
              <ul className="list">
                {recent.map((entry) => (
                  <li key={entry.id} className="recent-item">
                    <VoiceOrb seed={entry.voiceId} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div className="recent-text">{entry.textPreview}</div>
                      <div className="meta-list">
                        <span>{voiceLabel(entry.voiceId, presets)}</span>
                        <span className="num">{formatDuration(entry.durationMs / 1000)}</span>
                        <span>{new Date(entry.createdAt).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                    <div className="recent-actions">
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => void openEntry(entry, 'play')} aria-label={t('recent.play')} title={t('recent.play')}>
                        <PlayIcon />
                      </button>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => void openEntry(entry, 'download')} aria-label={t('recent.download')} title={t('recent.download')}>
                        <DownloadIcon />
                      </button>
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => void deleteEntry(entry)} aria-label={t('recent.delete')} title={t('recent.delete')}>
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {recentTotal > recent.length && (
              <div className="row-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecentLimit((limit) => limit + RECENT_PAGE)}>
                  {t('recent.more', { n: recentTotal - recent.length })}
                </button>
              </div>
            )}
            {recent.length > 0 && (
              <p className="help" style={{ margin: 0 }}>
                {t('recent.retention', { days: RETENTION_DAYS })}
              </p>
            )}
          </section>
        </div>
      </section>

      <Inspector open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}
