// Create a voice from a description (F7, spec 4.8): persona builder, editable prompt, sample, save.
import { useState } from 'react';
import { MAX_PROMPT_CHARS, MAX_STYLE_CHARS, MAX_VOICE_NAME_CHARS, type VoiceGender } from '../../../shared/schemas.ts';
import { PREBUILT_VOICES } from '../../../shared/voices.ts';
import { createVoice } from '../../app/api.ts';
import { clipFromWav, errorText } from '../../app/errors.ts';
import { useT } from '../../app/i18n.ts';
import { useSettings } from '../../app/settings.ts';
import { usePlayer, useToasts } from '../../app/stores.ts';
import { savePreset } from '../../app/voices.ts';
import { base64ToBytes } from '../../audio/pcm.ts';
import type { PersonaBuilder, VoicePreset } from '../../db/schema.ts';
import { VoiceOrb } from '../../ui/components/VoiceOrb.tsx';
import { ACCENTS, AGES, choiceLabel, composePrompt, DEFAULT_BUILDER, DELIVERIES, LANGUAGES, MAX_TIMBRES, TIMBRES } from './persona.ts';

interface VoiceDesignerProps {
  onUse: (preset: VoicePreset) => void;
  /** Prebuilt voice to start from ("Create a variant" in the Google voices tab). */
  initialBase?: string;
}

export function VoiceDesigner({ onUse, initialBase = '' }: VoiceDesignerProps) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const loadClip = usePlayer((s) => s.load);
  const toast = useToasts((s) => s.push);
  const [builder, setBuilder] = useState<PersonaBuilder>(DEFAULT_BUILDER);
  const [name, setName] = useState('');
  const [base, setBase] = useState(initialBase);
  const [direction, setDirection] = useState('');
  const [promptOverride, setPromptOverride] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<VoicePreset | null>(null);
  /** Starting voice Google refused to build on: the voice was designed from the description alone. */
  const [fallbackFrom, setFallbackFrom] = useState<string | null>(null);

  const prompt = promptOverride ?? composePrompt(builder);
  const patch = (change: Partial<PersonaBuilder>) => setBuilder((b) => ({ ...b, ...change }));

  const toggleTimbre = (id: string) =>
    patch({ timbres: builder.timbres.includes(id) ? builder.timbres.filter((x) => x !== id) : [...builder.timbres, id].slice(-MAX_TIMBRES) });

  const listen = async (preset: VoicePreset) => {
    if (preset.sample) loadClip({ ...(await clipFromWav(preset.id, preset.sample, preset.name, `${preset.name}-sample.wav`)), subtitle: t('mine.sample'), seed: preset.voiceId }, true);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError(t('design.nameRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const voice = await createVoice({
        type: 'prompted',
        displayName: name.trim(),
        gender: builder.gender,
        languageCode: builder.languageCode,
        prompt,
        // The description is complete on its own: if Google refuses to start from the base voice
        // (spec F15), the server designs a fresh voice from it and flags `remixFallback`.
        ...(base ? { baseVoice: base, ...(prompt.trim().length >= 10 ? { fallbackPrompt: prompt } : {}) } : {}),
      });
      const fromBase = base && !voice.remixFallback ? base : '';
      const now = Date.now();
      const preset: VoicePreset = {
        id: crypto.randomUUID(),
        name: name.trim(),
        source: 'designed',
        voiceId: voice.id,
        gender: builder.gender,
        languageCode: builder.languageCode,
        accent: builder.accent,
        prompt: fromBase ? `${fromBase}: ${prompt}` : prompt,
        builder,
        styleLine: direction.trim(),
        sample: voice.sampleWav ? new Blob([base64ToBytes(voice.sampleWav)], { type: 'audio/wav' }) : null,
        eqCurve: [],
        matchScore: null,
        fingerprint: null,
        createdAt: now,
        updatedAt: now,
      };
      await savePreset(preset);
      setFallbackFrom(voice.remixFallback ? base : null);
      setCreated(preset);
      toast('success', t('design.created', { name: preset.name }));
      void listen(preset);
    } catch (err) {
      setError(errorText(t, err, true));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <section className="card result-card" aria-live="polite">
        <h2>{t('design.result')}</h2>
        {fallbackFrom && <p className="notice">{t('design.baseFallback', { base: fallbackFrom })}</p>}
        <div className="identity">
          <VoiceOrb seed={created.voiceId} size={48} />
          <div>
            <p className="voice-card-name">{created.name}</p>
            <p className="voice-card-prompt">{created.prompt}</p>
          </div>
        </div>
        <div className="row-actions">
          <button type="button" className="btn" disabled={!created.sample} onClick={() => void listen(created)}>
            {t('mine.listen')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onUse(created)}>
            {t('design.useNow')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCreated(null);
              setFallbackFrom(null);
              setName('');
            }}
          >
            {t('design.another')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="field span-2">
        <label className="field-label" htmlFor="voice-name">
          {t('design.name')}
        </label>
        <input id="voice-name" className="input" maxLength={MAX_VOICE_NAME_CHARS} value={name} placeholder={t('design.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="voice-base">
          {t('design.base')}
        </label>
        <select id="voice-base" className="select" value={base} onChange={(e) => setBase(e.target.value)}>
          <option value="">{t('design.base.none')}</option>
          {PREBUILT_VOICES.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.descriptor}, {t(`gender.${v.gender}`).toLowerCase()})
            </option>
          ))}
        </select>
        {base && <p className="help">{t('design.base.hint')}</p>}
      </div>

      <fieldset className="field">
        <legend className="field-label">{t('design.gender')}</legend>
        <div className="segmented">
          {(['female', 'male', 'neutral'] as VoiceGender[]).map((g) => (
            <label key={g}>
              <input type="radio" name="gender" checked={builder.gender === g} onChange={() => patch({ gender: g })} />
              {t(`gender.${g}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field-label" htmlFor="voice-age">
          {t('design.age')}
        </label>
        <select id="voice-age" className="select" value={builder.age} onChange={(e) => patch({ age: e.target.value as PersonaBuilder['age'] })}>
          {AGES.map((a) => (
            <option key={a.id} value={a.id}>
              {a[lang]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="voice-lang">
          {t('design.language')}
        </label>
        <select id="voice-lang" className="select" value={builder.languageCode} onChange={(e) => patch({ languageCode: e.target.value })}>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l[lang]}
            </option>
          ))}
        </select>
      </div>

      <div className="field span-2">
        <label className="field-label" htmlFor="voice-accent">
          {t('design.accent')}
        </label>
        <input id="voice-accent" className="input" list="accent-options" value={builder.accent} placeholder={t('design.accentPlaceholder')} maxLength={80} onChange={(e) => patch({ accent: e.target.value })} />
        <datalist id="accent-options">
          {ACCENTS.map((a) => (
            <option key={a.id} value={a[lang]} />
          ))}
        </datalist>
      </div>

      <fieldset className="field span-2">
        <legend className="field-label">{t('design.timbre')}</legend>
        <div className="chips-row">
          {TIMBRES.map((tb) => (
            <button key={tb.id} type="button" className="chip" aria-pressed={builder.timbres.includes(tb.id)} onClick={() => toggleTimbre(tb.id)}>
              {tb[lang]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field-label" htmlFor="voice-delivery">
          {t('design.delivery')}
        </label>
        <select id="voice-delivery" className="select" value={builder.delivery} onChange={(e) => patch({ delivery: e.target.value })}>
          <option value="">{t('design.none')}</option>
          {DELIVERIES.map((d) => (
            <option key={d.id} value={d.id}>
              {choiceLabel(DELIVERIES, d.id, lang)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="voice-direction">
          {t('design.direction')}
        </label>
        <textarea id="voice-direction" className="input" rows={2} maxLength={MAX_STYLE_CHARS} value={direction} placeholder={t('inspector.stylePlaceholder')} onChange={(e) => setDirection(e.target.value)} />
      </div>

      <div className="field span-2">
        <label className="field-label" htmlFor="voice-free">
          {t('design.freeText')}
        </label>
        <textarea id="voice-free" className="input" rows={2} maxLength={400} value={builder.freeText} placeholder={t('design.freeTextPlaceholder')} onChange={(e) => patch({ freeText: e.target.value })} />
      </div>

      <div className="field span-2">
        <label className="field-label" htmlFor="voice-prompt">
          {t('design.prompt')}{' '}
          <span className="counter">
            {prompt.length} / {MAX_PROMPT_CHARS}
          </span>
        </label>
        <textarea id="voice-prompt" className="input" rows={3} maxLength={MAX_PROMPT_CHARS} value={prompt} onChange={(e) => setPromptOverride(e.target.value)} />
        <p className="help">
          {t('design.promptHint')}{' '}
          {promptOverride !== null && (
            <button type="button" className="link-btn" onClick={() => setPromptOverride(null)}>
              {t('design.promptReset')}
            </button>
          )}
        </p>
      </div>

      {error && (
        <p className="alert span-2" role="alert">
          {error}
        </p>
      )}

      <div className="span-2 row-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || prompt.trim().length < 3}>
          {busy ? t('design.creating') : t('design.create')}
        </button>
        <span className="help" style={{ margin: 0 }}>
          {t('design.billingNote')}
        </span>
      </div>
    </form>
  );
}
