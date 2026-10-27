// New audiobook form (spec F16): text or file, voice with preview, direction, model, live analysis.
import { useDeferredValue, useMemo, useState } from 'react';
import { MAX_STYLE_CHARS } from '../../../shared/schemas.ts';
import type { TtsModel } from '../../../shared/models.ts';
import { PREBUILT_VOICES } from '../../../shared/voices.ts';
import { formatDuration } from '../../app/format.ts';
import { useT } from '../../app/i18n.ts';
import { quotaResetLabel } from '../../app/quota.ts';
import { useSettings } from '../../app/settings.ts';
import { useVoices, voiceLabel } from '../../app/voices.ts';
import { PreviewButton } from '../../ui/components/PreviewButton.tsx';
import { createBook, MAX_BOOK_CHARS } from './books.ts';
import { planBook } from './chunker.ts';
import { decodeText } from './textFile.ts';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const LONG_BOOK_PAGES = 60;

interface NewBookProps {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

export function NewBook({ onCreated, onCancel }: NewBookProps) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const settings = useSettings();
  const presets = useVoices((s) => s.presets);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState(settings.voice);
  const [style, setStyle] = useState(settings.style);
  const [model, setModel] = useState<TtsModel>(settings.model);
  const [readTitles, setReadTitles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deferredText = useDeferredValue(text);

  const plan = useMemo(() => (deferredText.trim() ? planBook(deferredText, title.trim() || t('book.title'), readTitles) : null), [deferredText, title, readTitles, t]);
  const tooLong = text.length > MAX_BOOK_CHARS;
  const preset = presets.find((p) => p.voiceId === voiceId);

  const chooseVoice = (id: string) => {
    setVoiceId(id);
    const chosen = presets.find((p) => p.voiceId === id);
    if (chosen?.styleLine) setStyle(chosen.styleLine);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(t('book.importTooBig'));
      return;
    }
    try {
      const content = decodeText(new Uint8Array(await file.arrayBuffer()));
      setText(content);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch {
      setError(t('book.importFailed'));
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      setError(t('book.nameRequired'));
      return;
    }
    if (!plan || plan.segments.length === 0) {
      setError(t('error.EMPTY'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createBook({ title: title.trim(), text, voiceId, voiceName: voiceLabel(voiceId, presets), style: style.trim(), model, readTitles });
      onCreated(id);
    } catch {
      setError(t('error.generic'));
      setBusy(false);
    }
  };

  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="field span-2">
        <label className="field-label" htmlFor="book-title">
          {t('book.name')}
        </label>
        <input id="book-title" className="input" maxLength={120} value={title} placeholder={t('book.namePlaceholder')} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="field span-2">
        <label className="field-label" htmlFor="book-text">
          {t('book.text')}{' '}
          <span className="counter">
            {text.length.toLocaleString(lang)} / {MAX_BOOK_CHARS.toLocaleString(lang)}
          </span>
        </label>
        <textarea id="book-text" className="input book-text" rows={14} value={text} placeholder={t('book.textPlaceholder')} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <div className="row-actions" style={{ marginTop: 8 }}>
          <label className="btn btn-sm">
            {t('book.import')}
            <input type="file" accept=".txt,.md,text/plain,text/markdown" className="visually-hidden" onChange={(e) => void importFile(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="book-voice">
          {t('book.voice')}
        </label>
        <div className="row-actions" style={{ flexWrap: 'nowrap' }}>
          <select id="book-voice" className="select" value={voiceId} onChange={(e) => chooseVoice(e.target.value)}>
            {presets.length > 0 && (
              <optgroup label={t('book.myVoices')}>
                {presets.map((p) => (
                  <option key={p.id} value={p.voiceId}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={t('book.googleVoices')}>
              {PREBUILT_VOICES.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.descriptor}, {t(`gender.${v.gender}`).toLowerCase()})
                </option>
              ))}
            </optgroup>
          </select>
          <PreviewButton target={{ voiceId, name: voiceLabel(voiceId, presets), languageCode: preset?.languageCode }} />
        </div>
      </div>

      <fieldset className="field">
        <legend className="field-label">{t('inspector.model')}</legend>
        <div className="segmented">
          <label>
            <input type="radio" name="book-model" checked={model === 'gemini-3.8-flash-tts'} onChange={() => setModel('gemini-3.8-flash-tts')} />
            {t('inspector.model.flash')}
          </label>
          <label>
            <input type="radio" name="book-model" checked={model === 'gemini-3.8-flash-lite-tts'} onChange={() => setModel('gemini-3.8-flash-lite-tts')} />
            {t('inspector.model.lite')}
          </label>
        </div>
      </fieldset>

      <div className="field span-2">
        <label className="field-label" htmlFor="book-style">
          {t('inspector.style')}{' '}
          <span className="counter">
            {style.length} / {MAX_STYLE_CHARS}
          </span>
        </label>
        <textarea id="book-style" className="input" rows={2} maxLength={MAX_STYLE_CHARS} value={style} placeholder={t('inspector.stylePlaceholder')} onChange={(e) => setStyle(e.target.value)} />
        <p className="help">{t('inspector.styleHint')}</p>
      </div>

      <label className="check span-2">
        <input type="checkbox" checked={readTitles} onChange={(e) => setReadTitles(e.target.checked)} />
        <span>{t('book.readTitles')}</span>
      </label>

      {plan && (
        <div className="span-2 stack" style={{ gap: 8 }}>
          <p className="book-analysis">
            {t('book.analysis', {
              pages: plan.pages,
              words: plan.words.toLocaleString(lang),
              chapters: plan.chapters.length,
              duration: formatDuration(plan.estimatedSeconds),
              requests: plan.segments.length,
            })}
          </p>
          <ol className="chapter-preview">
            {plan.chapters.slice(0, 12).map((c, i) => (
              <li key={`${i}-${c.title}`}>{c.title}</li>
            ))}
            {plan.chapters.length > 12 && <li>…</li>}
          </ol>
          <p className="help" style={{ margin: 0 }}>
            {t('book.quotaNote', { time: quotaResetLabel(lang) })}
          </p>
          {plan.pages > LONG_BOOK_PAGES && !tooLong && <p className="notice">{t('book.longWarning')}</p>}
        </div>
      )}

      {tooLong && (
        <p className="alert span-2" role="alert">
          {t('book.tooLong')}
        </p>
      )}
      {error && (
        <p className="alert span-2" role="alert">
          {error}
        </p>
      )}

      <div className="span-2 row-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || tooLong || !plan}>
          {t('book.create')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('mine.cancel')}
        </button>
      </div>
    </form>
  );
}
