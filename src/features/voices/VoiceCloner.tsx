// Clone my voice (F8, spec 4.7): sample, live consent, attestation, then Google's replication.
import { useEffect, useRef, useState } from 'react';
import { CLONE_LIMITS, CONSENT_LOCALES, CONSENT_STATEMENTS, UPLOAD_LIMITS, type ConsentLocale } from '../../../shared/consent.ts';
import { MAX_VOICE_NAME_CHARS } from '../../../shared/schemas.ts';
import { createVoice } from '../../app/api.ts';
import { clipFromWav, errorText } from '../../app/errors.ts';
import { useT } from '../../app/i18n.ts';
import { useSettings } from '../../app/settings.ts';
import { usePlayer, useToasts } from '../../app/stores.ts';
import { savePreset } from '../../app/voices.ts';
import { mediaDuration, prepareClip, sha256Hex, startRecording, uploadProblem, type PreparedClip, type Recording } from '../../audio/capture.ts';
import { bytesToBase64, judgeLevels } from '../../audio/pcm.ts';
import type { VoicePreset } from '../../db/schema.ts';

type Target = 'source' | 'consent';

const LOCALE_LABELS: Record<ConsentLocale, string> = {
  'fr-FR': 'Français (France)',
  'fr-CA': 'Français (Canada)',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
};

interface VoiceClonerProps {
  onUse: (preset: VoicePreset) => void;
}

export function VoiceCloner({ onUse }: VoiceClonerProps) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const loadClip = usePlayer((s) => s.load);
  const toast = useToasts((s) => s.push);
  const [source, setSource] = useState<PreparedClip | null>(null);
  const [consent, setConsent] = useState<PreparedClip | null>(null);
  const [locale, setLocale] = useState<ConsentLocale>(lang === 'fr' ? 'fr-FR' : 'en-US');
  const [name, setName] = useState('');
  const [attested, setAttested] = useState(false);
  const [recording, setRecording] = useState<Target | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<VoicePreset | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recordingRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsed(seconds);
      if (seconds >= CLONE_LIMITS.maxSourceSec) void stop();
    }, 250);
    return () => window.clearInterval(timer);
    // The timer restarts with each recording; stop() reads the active recording from a ref.
  }, [recording]);

  const accept = (target: Target, clip: PreparedClip) => (target === 'source' ? setSource(clip) : setConsent(clip));

  const record = async (target: Target) => {
    setError(null);
    try {
      const started = await startRecording();
      // The page may have been left while the permission prompt was open: release the mic at once.
      if (!mountedRef.current) {
        started.cancel();
        return;
      }
      recordingRef.current = started;
      setElapsed(0);
      setRecording(target);
    } catch {
      setError(t('clone.micDenied'));
    }
  };

  const stop = async () => {
    const active = recordingRef.current;
    const target = recording;
    if (!active || !target) return;
    recordingRef.current = null;
    setRecording(null);
    try {
      accept(target, await prepareClip(await active.stop(), CLONE_LIMITS.maxSourceSec));
    } catch {
      setError(t('clone.decodeFailed'));
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Checked before decoding (spec S6): a long file decoded in full would take hundreds of MB.
    const problem = uploadProblem(file.size, await mediaDuration(file));
    if (problem) {
      setError(t(`clone.${problem}`, { mb: UPLOAD_LIMITS.maxBytes / (1024 * 1024), min: UPLOAD_LIMITS.maxSec / 60 }));
      return;
    }
    try {
      setSource(await prepareClip(file, CLONE_LIMITS.maxSourceSec));
    } catch {
      setError(t('clone.decodeFailed'));
    }
  };

  const listen = async (clip: PreparedClip, title: string) => {
    loadClip(await clipFromWav(title, new Blob([clip.wav], { type: 'audio/wav' }), title, `${title}.wav`), true);
  };

  const sourceOk = source !== null && source.seconds >= CLONE_LIMITS.minSourceSec && judgeLevels(source.stats) !== 'silent';
  const consentOk = consent !== null && consent.seconds >= CLONE_LIMITS.minConsentSec && judgeLevels(consent.stats) !== 'silent';
  const canSubmit = sourceOk && consentOk && attested && name.trim().length > 0 && !busy && recording === null;

  const submit = async () => {
    if (!source || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const voice = await createVoice({
        type: 'replicated',
        displayName: name.trim(),
        languageCode: locale,
        sourceWav: bytesToBase64(source.wav),
        consentWav: bytesToBase64(consent.wav),
      });
      const now = Date.now();
      const preset: VoicePreset = {
        id: crypto.randomUUID(),
        name: name.trim(),
        source: 'replicated',
        voiceId: voice.id,
        gender: null,
        languageCode: locale,
        accent: '',
        prompt: '',
        builder: null,
        styleLine: '',
        sample: null,
        eqCurve: [],
        matchScore: null,
        fingerprint: null,
        consent: { date: now, locale, sha256Source: await sha256Hex(source.wav), sha256Consent: await sha256Hex(consent.wav) },
        createdAt: now,
        updatedAt: now,
      };
      await savePreset(preset);
      // Spec S4: the raw clips are not kept after the call.
      setSource(null);
      setConsent(null);
      setCreated(preset);
      toast('success', t('clone.done', { name: preset.name }));
    } catch (err) {
      setError(errorText(t, err, true));
    } finally {
      setBusy(false);
    }
  };

  const levelNote = (clip: PreparedClip) => {
    const verdict = judgeLevels(clip.stats);
    return <span className={verdict === 'ok' ? 'ok-text' : 'warn-text'}>{t(`clone.level.${verdict}`)}</span>;
  };

  if (created) {
    return (
      <section className="card result-card" aria-live="polite">
        <h2>{t('clone.done', { name: created.name })}</h2>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => onUse(created)}>
            {t('design.useNow')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="notice" aria-labelledby="clone-warning">
        <div>
          <strong id="clone-warning">{t('clone.warningTitle')}</strong>
          <p style={{ margin: '4px 0 0' }}>{t('clone.warning')}</p>
        </div>
      </section>

      <section className="card stack">
        <h2>{t('clone.step1')}</h2>
        <p className="help" style={{ marginTop: 0 }}>
          {t('clone.step1Hint')}
        </p>
        <div className="row-actions">
          {recording === 'source' ? (
            <button type="button" className="btn btn-danger" onClick={() => void stop()}>
              ● {t('clone.stop')} · {t('clone.recording', { s: elapsed })}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => void record('source')} disabled={recording !== null}>
              {t('clone.record')}
            </button>
          )}
          <label className="btn">
            {t('clone.upload')}
            <input type="file" accept="audio/*" className="visually-hidden" onChange={(e) => void upload(e.target.files?.[0])} disabled={recording !== null} />
          </label>
        </div>
        {source && (
          <p className="help">
            {t('clone.ready', { s: source.seconds.toFixed(1) })} · {levelNote(source)}
            {source.trimmed && <> · {t('clone.trimmed')}</>}
            {source.seconds < CLONE_LIMITS.minSourceSec && <> · <span className="warn-text">{t('clone.tooShort', { min: CLONE_LIMITS.minSourceSec })}</span></>}{' '}
            <button type="button" className="link-btn" onClick={() => void listen(source, 'source')}>
              {t('clone.listen')}
            </button>
          </p>
        )}
      </section>

      <section className="card stack">
        <h2>{t('clone.step2')}</h2>
        <div className="field" style={{ maxWidth: 320 }}>
          <label className="field-label" htmlFor="consent-locale">
            {t('clone.consentLang')}
          </label>
          <select id="consent-locale" className="select" value={locale} onChange={(e) => setLocale(e.target.value as ConsentLocale)}>
            {CONSENT_LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <p className="help" style={{ marginTop: 0 }}>
          {t('clone.step2Hint')}
        </p>
        <blockquote className="consent-quote" lang={locale}>
          {CONSENT_STATEMENTS[locale]}
        </blockquote>
        <div className="row-actions">
          {recording === 'consent' ? (
            <button type="button" className="btn btn-danger" onClick={() => void stop()}>
              ● {t('clone.stop')} · {t('clone.recording', { s: elapsed })}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => void record('consent')} disabled={recording !== null}>
              {t('clone.record')}
            </button>
          )}
        </div>
        {consent && (
          <p className="help">
            {t('clone.ready', { s: consent.seconds.toFixed(1) })} · {levelNote(consent)}{' '}
            <button type="button" className="link-btn" onClick={() => void listen(consent, 'consent')}>
              {t('clone.listen')}
            </button>
          </p>
        )}
      </section>

      <section className="card stack">
        <h2>{t('clone.step3')}</h2>
        <div className="field" style={{ maxWidth: 420 }}>
          <label className="field-label" htmlFor="clone-name">
            {t('design.name')}
          </label>
          <input id="clone-name" className="input" maxLength={MAX_VOICE_NAME_CHARS} value={name} placeholder={t('design.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
          <span>{t('clone.attest')}</span>
        </label>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="row-actions">
          <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={() => void submit()}>
            {busy ? t('clone.submitting') : t('clone.submit')}
          </button>
        </div>
      </section>
    </div>
  );
}
