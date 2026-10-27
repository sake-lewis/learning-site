// My voices (F7, F15): saved voices with listen, use, rename, modify by prompt, delete, sync.
import { useEffect, useRef, useState } from 'react';
import { MAX_STYLE_CHARS, MAX_VOICE_NAME_CHARS, type VoiceSummary } from '../../../shared/schemas.ts';
import { createVoice, deleteVoice, getVoice, listVoices } from '../../app/api.ts';
import { clipFromWav, errorText } from '../../app/errors.ts';
import { useT, type MessageKey } from '../../app/i18n.ts';
import { useSettings } from '../../app/settings.ts';
import { usePreviewState, useVoicePreview } from '../../app/previews.ts';
import { usePlayer, useToasts } from '../../app/stores.ts';
import { removePreset, savePreset, useVoices } from '../../app/voices.ts';
import { base64ToBytes } from '../../audio/pcm.ts';
import type { VoicePreset } from '../../db/schema.ts';
import { EqLoader } from '../../ui/components/Brand.tsx';
import { VoiceOrb } from '../../ui/components/VoiceOrb.tsx';
import { PlayIcon, RefreshIcon } from '../../ui/icons.tsx';
import { choiceLabel, LANGUAGES, mergeRemixPrompt } from './persona.ts';

const SAMPLE_FETCH_LIMIT = 10;

function sampleBlob(voice: VoiceSummary): Blob | null {
  return voice.sampleWav ? new Blob([base64ToBytes(voice.sampleWav)], { type: 'audio/wav' }) : null;
}

function normaliseGender(value: string | undefined): VoicePreset['gender'] {
  const g = value?.toLowerCase();
  return g === 'female' || g === 'male' || g === 'neutral' ? g : null;
}

interface MyVoicesProps {
  onCreate: () => void;
  onUse: (preset: VoicePreset) => void;
}

export function MyVoices({ onCreate, onUse }: MyVoicesProps) {
  const t = useT();
  const presets = useVoices((s) => s.presets);
  const toast = useToasts((s) => s.push);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const remote = await listVoices();
      const known = new Set(presets.map((p) => p.voiceId));
      const missing = remote.filter((v) => !known.has(v.id));
      let fetched = 0;
      for (const voice of missing) {
        // The list omits samples: fetch them for designed voices, a few at a time.
        let full = voice;
        if (voice.type === 'prompted' && fetched < SAMPLE_FETCH_LIMIT) {
          fetched++;
          full = await getVoice(voice.id).catch(() => voice);
        }
        const now = Date.now();
        await savePreset({
          id: crypto.randomUUID(),
          name: full.displayName || full.id,
          source: full.type === 'replicated' ? 'replicated' : 'designed',
          voiceId: full.id,
          gender: normaliseGender(full.gender),
          languageCode: full.languageCode ?? null,
          accent: full.accent ?? '',
          prompt: full.prompt ?? '',
          builder: null,
          styleLine: '',
          sample: sampleBlob(full),
          eqCurve: [],
          matchScore: null,
          fingerprint: null,
          createdAt: now,
          updatedAt: now,
        });
      }
      toast('success', missing.length > 0 ? t('mine.synced', { n: missing.length }) : t('mine.syncedNone'));
    } catch (error) {
      setSyncError(errorText(t, error, true));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="stack">
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => void sync()} disabled={syncing}>
          {syncing ? t('mine.syncing') : t('mine.sync')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          {t('voices.tab.design')}
        </button>
      </div>
      {syncError && (
        <p className="alert" role="alert">
          {syncError}
        </p>
      )}
      {presets.length === 0 ? (
        <p className="empty">{t('mine.empty')}</p>
      ) : (
        <ul className="voice-cards">
          {presets.map((preset) => (
            <VoiceCard key={preset.id} preset={preset} onUse={onUse} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VoiceCard({ preset, onUse }: { preset: VoicePreset; onUse: (preset: VoicePreset) => void }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const currentVoice = useSettings((s) => s.voice);
  const updateSettings = useSettings((s) => s.update);
  const loadClip = usePlayer((s) => s.load);
  const toast = useToasts((s) => s.push);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(preset.name);
  const [direction, setDirection] = useState(preset.styleLine);
  const [remixing, setRemixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useVoicePreview();
  const previewLoading = usePreviewState((s) => s.loadingId);
  const previewTarget = { voiceId: preset.voiceId, name: preset.name, languageCode: preset.languageCode };

  const meta = [
    t(`mine.source.${preset.source}` as MessageKey),
    preset.gender ? t(`gender.${preset.gender}`) : null,
    preset.languageCode ? choiceLabel(LANGUAGES, preset.languageCode, lang) : null,
    preset.accent || null,
  ].filter(Boolean);

  const listen = async () => {
    if (preset.sample) loadClip({ ...(await clipFromWav(preset.id, preset.sample, preset.name, `${preset.name}-sample.wav`)), subtitle: t('mine.sample'), seed: preset.voiceId }, true);
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed) await savePreset({ ...preset, name: trimmed, updatedAt: Date.now() });
    setRenaming(false);
  };

  const saveDirection = async () => {
    if (direction.trim() !== preset.styleLine) await savePreset({ ...preset, styleLine: direction.trim(), updatedAt: Date.now() });
  };

  const remove = async () => {
    if (!window.confirm(t('mine.deleteConfirm', { name: preset.name }))) return;
    setError(null);
    try {
      if (preset.voiceId.startsWith('voice_')) await deleteVoice(preset.voiceId);
      await removePreset(preset.id);
      if (currentVoice === preset.voiceId) updateSettings({ voice: 'Kore' });
      toast('info', t('mine.deleted'));
    } catch (err) {
      setError(errorText(t, err, true));
    }
  };

  return (
    <li className={`card voice-card${currentVoice === preset.voiceId ? ' current' : ''}`}>
      <div className="voice-card-head">
        {renaming ? (
          <form
            className="row-actions"
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <input className="input" aria-label={t('design.name')} maxLength={MAX_VOICE_NAME_CHARS} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <button type="submit" className="btn btn-sm">
              {t('mine.save')}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenaming(false)}>
              {t('mine.cancel')}
            </button>
          </form>
        ) : (
          <div className="identity">
            <VoiceOrb seed={preset.voiceId} size={48} />
            <div style={{ minWidth: 0 }}>
              <p className="voice-card-name">{preset.name}</p>
              <p className="meta-list voice-card-meta">
                {meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </p>
            </div>
          </div>
        )}
        <div className="row-actions">
          <button type="button" className="btn btn-sm" onClick={() => void preview(previewTarget)} disabled={previewLoading !== null} title={t('preview.listen')}>
            {previewLoading === preset.voiceId ? <EqLoader /> : <PlayIcon />} {t('mine.test')}
          </button>
          <button type="button" className="btn btn-sm btn-ghost btn-icon" onClick={() => void preview(previewTarget, true)} disabled={previewLoading !== null} aria-label={t('preview.another')} title={t('preview.another')}>
            <RefreshIcon />
          </button>
          {preset.sample && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => void listen()}>
              {t('mine.sample')}
            </button>
          )}
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onUse(preset)}>
            {t('mine.use')}
          </button>
        </div>
      </div>

      {preset.prompt && (
        <p className="voice-card-prompt">
          <span className="field-label">{t('mine.prompt')}</span>
          {preset.prompt}
        </p>
      )}

      <div className="field">
        <label className="field-label" htmlFor={`dir-${preset.id}`}>
          {t('mine.direction')}
        </label>
        <textarea
          id={`dir-${preset.id}`}
          className="input"
          rows={2}
          maxLength={MAX_STYLE_CHARS}
          value={direction}
          placeholder={t('inspector.stylePlaceholder')}
          onChange={(e) => setDirection(e.target.value)}
          onBlur={() => void saveDirection()}
        />
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <div className="row-actions">
        {preset.voiceId.startsWith('voice_') && (
          <button type="button" className="btn btn-sm" onClick={() => setRemixing((v) => !v)} aria-expanded={remixing}>
            {t('mine.modify')}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenaming(true)}>
          {t('mine.rename')}
        </button>
        <button type="button" className="btn btn-sm btn-ghost danger-text" onClick={() => void remove()}>
          {t('mine.delete')}
        </button>
      </div>

      {remixing && <RemixPanel preset={preset} onDone={() => setRemixing(false)} />}
    </li>
  );
}

function RemixPanel({ preset, onDone }: { preset: VoicePreset; onDone: () => void }) {
  const t = useT();
  const currentVoice = useSettings((s) => s.voice);
  const updateSettings = useSettings((s) => s.update);
  const loadClip = usePlayer((s) => s.load);
  const toast = useToasts((s) => s.push);
  const [change, setChange] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ voice: VoiceSummary; sample: Blob | null } | null>(null);
  const suggestions = (['remix.s1', 'remix.s2', 'remix.s3', 'remix.s4', 'remix.s5', 'remix.s6'] as const).map((k) => t(k));

  // A new version the user has neither kept nor discarded is deleted at Google if the panel closes,
  // so no orphan voice counts against the 200-voice limit.
  const undecided = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (undecided.current) void deleteVoice(undecided.current).catch(() => undefined);
    },
    [],
  );

  const addSuggestion = (s: string) => setChange((c) => (c.trim() ? `${c.trim()}, ${s}` : s));

  const listenTo = async (id: string, blob: Blob | null, version: string) => {
    if (blob) loadClip({ ...(await clipFromWav(id, blob, preset.name, `${preset.name}-${version}.wav`)), subtitle: version, seed: id }, true);
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const voice = await createVoice({
        type: 'prompted',
        displayName: preset.name,
        gender: preset.gender ?? 'neutral',
        languageCode: preset.languageCode ?? 'fr-FR',
        prompt: change.trim(),
        baseVoice: preset.voiceId,
        ...(preset.prompt ? { fallbackPrompt: mergeRemixPrompt(preset.prompt, change) } : {}),
      });
      const sample = sampleBlob(voice);
      undecided.current = voice.id;
      setResult({ voice, sample });
      void listenTo(voice.id, sample, 'v2');
    } catch (err) {
      setError(errorText(t, err, true));
    } finally {
      setBusy(false);
    }
  };

  // Save the new version first; only then delete the old voice, so a failed save never leaves the
  // preset pointing at a deleted voice.
  const keepNew = async () => {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      await savePreset({
        ...preset,
        voiceId: result.voice.id,
        prompt: mergeRemixPrompt(preset.prompt, change),
        sample: result.sample ?? preset.sample,
        updatedAt: Date.now(),
      });
      undecided.current = null;
      if (currentVoice === preset.voiceId) updateSettings({ voice: result.voice.id });
      await deleteVoice(preset.voiceId).catch(() => undefined);
      toast('success', t('remix.kept'));
      onDone();
    } catch (err) {
      setError(errorText(t, err, true));
    } finally {
      setBusy(false);
    }
  };

  const keepOld = async () => {
    if (!result) return;
    setBusy(true);
    try {
      await deleteVoice(result.voice.id).catch(() => undefined);
      undecided.current = null;
      toast('info', t('remix.discarded'));
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="remix">
      <p className="voice-card-name">{t('remix.title', { name: preset.name })}</p>
      {result ? (
        <>
          {result.voice.remixFallback && <p className="notice">{t('remix.fallback')}</p>}
          <p className="help">{t('remix.compare')}</p>
          <div className="row-actions">
            <button type="button" className="btn btn-sm" onClick={() => void listenTo(preset.voiceId, preset.sample, 'v1')} disabled={!preset.sample}>
              {t('mine.listen')} (v1)
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void listenTo(result.voice.id, result.sample, 'v2')} disabled={!result.sample}>
              {t('mine.listen')} (v2)
            </button>
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={() => void keepNew()} disabled={busy}>
              {t('remix.keepNew')}
            </button>
            <button type="button" className="btn" onClick={() => void keepOld()} disabled={busy}>
              {t('remix.keepOld')}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field-label" htmlFor={`remix-${preset.id}`}>
            {t('remix.label')}
          </label>
          <textarea id={`remix-${preset.id}`} className="input" rows={2} maxLength={400} value={change} placeholder={t('remix.placeholder')} onChange={(e) => setChange(e.target.value)} />
          <div className="chips-row">
            {suggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => addSuggestion(s)}>
                + {s}
              </button>
            ))}
          </div>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={() => void create()} disabled={busy || change.trim().length < 3}>
              {busy ? t('remix.creating') : t('remix.create')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDone} disabled={busy}>
              {t('mine.cancel')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
