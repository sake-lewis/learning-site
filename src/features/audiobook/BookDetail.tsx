// One audiobook (spec F16): progress, start / pause / resume, chapters to listen to and download.
import { useCallback, useEffect, useState } from 'react';
import { clipFromWav, errorText } from '../../app/errors.ts';
import { downloadBlob, formatDuration, slugify } from '../../app/format.ts';
import { errorKey, useT } from '../../app/i18n.ts';
import { quotaResetLabel } from '../../app/quota.ts';
import { useSettings } from '../../app/settings.ts';
import { usePlayer, useToasts } from '../../app/stores.ts';
import { db, type Book, type BookSegment } from '../../db/schema.ts';
import { EqLoader } from '../../ui/components/Brand.tsx';
import { VoiceOrb } from '../../ui/components/VoiceOrb.tsx';
import { DownloadIcon, PauseIcon, PlayIcon, RefreshIcon } from '../../ui/icons.tsx';
import { BookCover } from './BookCover.tsx';
import { bookSegments, chapterAudio, deleteBook, fullBookAudio, resetSegment } from './books.ts';
import { pauseRunner, startBook, useRunner } from './runner.ts';

const STYLE_PREVIEW_CHARS = 120;

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

interface BookDetailProps {
  id: string;
  onBack: () => void;
}

export function BookDetail({ id, onBack }: BookDetailProps) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const loadClip = usePlayer((s) => s.load);
  const toast = useToasts((s) => s.push);
  const runner = useRunner();
  const [book, setBook] = useState<Book | null>(null);
  const [segments, setSegments] = useState<BookSegment[]>([]);
  const [openChapter, setOpenChapter] = useState<number | null>(null);
  const [assembling, setAssembling] = useState<string | null>(null);
  const active = runner.bookId === id;
  const now = useNow(active);

  const reload = useCallback(async () => {
    const [b, s] = await Promise.all([db.books.get(id), bookSegments(id)]);
    setBook(b ?? null);
    setSegments(s);
  }, [id]);

  // Refresh after each runner step, and every 2 s while this book is generating.
  useEffect(() => {
    void reload();
  }, [reload, runner.phase, runner.segmentIndex, runner.doneThisRun, runner.bookId]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void reload(), 2000);
    return () => window.clearInterval(timer);
  }, [active, reload]);

  if (!book) return null;

  const total = segments.length;
  const done = segments.filter((s) => s.status === 'done').length;
  const generated = segments.reduce((sum, s) => sum + (s.status === 'done' ? s.seconds : 0), 0);
  const complete = total > 0 && done === total;
  const otherRunning = runner.bookId !== null && !active;

  let status: string;
  if (active && runner.phase === 'waiting' && runner.waitUntil) status = t('book.status.waiting', { s: Math.max(0, Math.ceil((runner.waitUntil - now) / 1000)) });
  else if (active) status = t('book.status.running', { n: (runner.segmentIndex ?? done) + 1, total });
  else if (book.status === 'done' || complete) status = t('book.status.done');
  else if (book.status === 'running') status = t('book.status.interrupted');
  else if (book.pause?.reason === 'quota') status = t('book.status.pausedQuota', { time: book.pause.resumeAfter ? new Date(book.pause.resumeAfter).toLocaleString(lang, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : quotaResetLabel(lang) });
  else if (book.pause?.reason === 'error') {
    const base = t(errorKey(book.pause.code), { time: quotaResetLabel(lang) });
    status = t('book.status.pausedError', { message: book.pause.detail ? `${base} ${t('error.detail', { detail: book.pause.detail })}` : base });
  } else if (book.status === 'paused') status = t('book.status.pausedUser');
  else status = t('book.status.ready');

  let eta = '';
  if (active && runner.startedAt && runner.doneThisRun > 0 && done < total) {
    const perSegment = (now - runner.startedAt) / runner.doneThisRun;
    eta = t('book.eta', { duration: formatDuration((perSegment * (total - done)) / 1000) });
  }

  const withAudio = async (label: string, build: () => Promise<{ blob: Blob; seconds: number }>, use: (audio: { blob: Blob; seconds: number }) => void) => {
    setAssembling(label);
    try {
      use(await build());
    } catch (error) {
      toast('error', error instanceof Error && error.message === 'INCOMPLETE' ? t('book.assembleFailed') : errorText(t, error));
    } finally {
      setAssembling(null);
    }
  };

  const chapterFile = (index: number) => `${slugify(book.title)}-${String(index + 1).padStart(2, '0')}-${slugify(book.chapters[index]?.title ?? '')}.wav`;

  const remove = async () => {
    if (!window.confirm(t('book.deleteConfirm', { name: book.title }))) return;
    await deleteBook(id);
    onBack();
  };

  const start = async () => {
    if ((await startBook(id)) === 'other-tab') toast('error', t('book.otherTab'));
  };

  const regenerate = async (segment: BookSegment) => {
    await resetSegment(segment.id);
    await reload();
  };

  return (
    <div className="stack">
      <div className="row-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← {t('book.back')}
        </button>
      </div>

      <section className="card stack">
        <div className="voice-card-head">
          <div className="identity">
            <BookCover title={book.title} size="lg" />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', letterSpacing: '-0.02em' }}>{book.title}</h2>
              <p className="meta-list voice-card-meta">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <VoiceOrb seed={book.voiceId} size={16} />
                  {t('book.voiceLine', { voice: book.voiceName })}
                </span>
                {/* A direction can hold 1,500 characters of context: show its start, the rest on hover. */}
                <span title={book.style || undefined}>
                  {t('book.styleLine', { style: book.style.length > STYLE_PREVIEW_CHARS ? `${book.style.slice(0, STYLE_PREVIEW_CHARS).trimEnd()}…` : book.style || t('book.noStyle') })}
                </span>
              </p>
            </div>
          </div>
          <div className="row-actions">
            {active ? (
              <button type="button" className="btn" onClick={pauseRunner}>
                <PauseIcon /> {t('book.pause')}
              </button>
            ) : (
              !complete && (
                <button type="button" className="btn btn-primary btn-lg" disabled={otherRunning} onClick={() => void start()}>
                  <PlayIcon /> {book.status === 'ready' ? t('book.start') : t('book.resume')}
                </button>
              )
            )}
            <button type="button" className="btn btn-ghost danger-text" onClick={() => void remove()}>
              {t('book.delete')}
            </button>
          </div>
        </div>

        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={t('book.progress', { done, total, duration: formatDuration(generated) })}>
          <div className="progress-bar" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <p className="meta-list">
          <span className="num">{t('book.progress', { done, total, duration: formatDuration(generated) })}</span>
          {eta && <span className="num">{eta}</span>}
        </p>
        {book.pause?.reason === 'error' && !active ? (
          <p className="alert" aria-live="polite">
            {status}
          </p>
        ) : (
          <p className="status-line" aria-live="polite">
            {active && <EqLoader />}
            {status}
          </p>
        )}

        {complete && (
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={assembling !== null}
              onClick={() => void withAudio('all', () => fullBookAudio(id), (a) => downloadBlob(a.blob, `${slugify(book.title)}.wav`))}
            >
              <DownloadIcon /> {t('book.downloadAll')}
            </button>
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">{t('book.chapters')}</h2>
        <ul className="list">
          {book.chapters.map((chapter, index) => {
            const own = segments.filter((s) => s.chapterIndex === index);
            const ownDone = own.filter((s) => s.status === 'done').length;
            const ready = own.length > 0 && ownDone === own.length;
            const label = `chapter-${index}`;
            return (
              <li key={label} className="chapter-row">
                <div className="voice-card-head">
                  <div style={{ minWidth: 0 }}>
                    <p className="voice-card-name">{chapter.title}</p>
                    <p className="meta-list voice-card-meta">
                      <span className="num">{t('book.chapterProgress', { done: ownDone, total: own.length })}</span>
                      {ready && <span className="ok-text">{t('book.chapterReady')}</span>}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!ready || assembling !== null}
                      onClick={() =>
                        void withAudio(label, () => chapterAudio(id, index), (a) =>
                          loadClip({ id: `${id}-${index}-${Date.now()}`, blob: a.blob, title: book.title, subtitle: chapter.title, seed: book.voiceId, fileName: chapterFile(index), seconds: a.seconds }, true),
                        )
                      }
                    >
                      <PlayIcon /> {t('book.listen')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!ready || assembling !== null}
                      onClick={() => void withAudio(label, () => chapterAudio(id, index), (a) => downloadBlob(a.blob, chapterFile(index)))}
                    >
                      <DownloadIcon /> {t('book.download')}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" aria-expanded={openChapter === index} onClick={() => setOpenChapter(openChapter === index ? null : index)}>
                      {t('book.showSegments')}
                    </button>
                  </div>
                </div>
                {openChapter === index && (
                  <ol className="segment-list">
                    {own.map((segment) => (
                      <li key={segment.id} className={`segment-row ${segment.status}`}>
                        <span className="segment-index">{String(segment.index + 1).padStart(2, '0')}</span>
                        <span className="segment-text">{segment.text.replace(/<[^>]+>/g, ' ').slice(0, 140)}…</span>
                        <span className="segment-state">
                          {segment.status === 'done' ? formatDuration(segment.seconds) : segment.status === 'failed' ? t('book.segmentFailed') : active && runner.segmentIndex === segment.index ? '…' : t('book.segmentPending')}
                        </span>
                        <span className="row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            disabled={segment.status !== 'done' || !segment.wav}
                            aria-label={t('book.listen')}
                            onClick={async () =>
                              segment.wav &&
                              loadClip(
                                {
                                  ...(await clipFromWav(segment.id, segment.wav, book.title, `${slugify(book.title)}-segment-${segment.index + 1}.wav`)),
                                  subtitle: `${chapter.title}, segment ${segment.index + 1}`,
                                  seed: book.voiceId,
                                },
                                true,
                              )
                            }
                          >
                            <PlayIcon />
                          </button>
                          <button type="button" className="btn btn-ghost btn-icon btn-sm" disabled={segment.status !== 'done'} aria-label={t('book.regenerate')} title={t('book.regenerate')} onClick={() => void regenerate(segment)}>
                            <RefreshIcon />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
