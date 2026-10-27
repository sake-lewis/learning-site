// Right-hand inspector (spec 6.1): model, voice, direction. A slide-over drawer below 1024 px.
import { useEffect, useState } from 'react';
import { MAX_STYLE_CHARS } from '../../../shared/schemas.ts';
import { PREBUILT_VOICES, type Gender } from '../../../shared/voices.ts';
import { useT } from '../../app/i18n.ts';
import { useSettings } from '../../app/settings.ts';
import { useVoices, voiceLabel } from '../../app/voices.ts';
import { PreviewButton } from '../../ui/components/PreviewButton.tsx';
import { VoiceOrb } from '../../ui/components/VoiceOrb.tsx';
import { CloseIcon } from '../../ui/icons.tsx';

interface InspectorProps {
  open: boolean;
  onClose: () => void;
}

export const VOICE_LIST_ID = 'voice-list';

export function Inspector({ open, onClose }: InspectorProps) {
  const t = useT();
  const { model, voice, style, update } = useSettings();
  const [filter, setFilter] = useState<'all' | Gender>('all');
  const presets = useVoices((s) => s.presets);
  const refreshPresets = useVoices((s) => s.refresh);
  useEffect(() => {
    void refreshPresets();
  }, [refreshPresets]);
  const voices = PREBUILT_VOICES.filter((v) => filter === 'all' || v.gender === filter);
  const myVoices = presets.filter((p) => filter === 'all' || p.gender === filter || p.gender === null);
  const styleExamples = [t('inspector.style.1'), t('inspector.style.2'), t('inspector.style.3')];

  return (
    <>
      <div className={`scrim${open ? ' open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`inspector${open ? ' open' : ''}`} aria-label={t('tts.voiceSettings')}>
        <div className="inspector-head">
          <strong>{t('tts.voiceSettings')}</strong>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('inspector.close')}>
            <CloseIcon />
          </button>
        </div>

        <div className="inspector-section" role="group" aria-labelledby="voice-heading">
          <p className="field-label" id="voice-heading">
            {t('inspector.voice')} <span className="counter">{voiceLabel(voice, presets)}</span>
          </p>
          <div className="segmented" role="group" aria-label={t('inspector.voice')}>
            {(['all', 'female', 'male'] as const).map((value) => (
              <label key={value}>
                <input type="radio" name="voice-filter" checked={filter === value} onChange={() => setFilter(value)} />
                {t(`inspector.filter.${value}`)}
              </label>
            ))}
          </div>
          <div className="voice-list" id={VOICE_LIST_ID} role="radiogroup" aria-label={t('inspector.voice')} tabIndex={-1}>
            <div className="voice-group">
              <span>{t('inspector.myVoices')}</span>
              <a href="#/voices" className="link-btn">
                {t('inspector.createVoice')}
              </a>
            </div>
            {myVoices.map((p) => (
              <label key={p.id} className="voice-option">
                <input
                  type="radio"
                  name="voice"
                  value={p.voiceId}
                  checked={voice === p.voiceId}
                  onChange={() => update({ voice: p.voiceId, ...(p.styleLine ? { style: p.styleLine } : {}) })}
                />
                <VoiceOrb seed={p.voiceId} size={26} />
                <span>
                  <span className="voice-name">{p.name}</span>
                  {p.accent && <span className="voice-desc">{p.accent}</span>}
                </span>
                <span className="voice-gender">{p.gender ? t(`gender.${p.gender}`).toLowerCase() : ''}</span>
                <PreviewButton target={{ voiceId: p.voiceId, name: p.name, languageCode: p.languageCode }} />
              </label>
            ))}
            <div className="voice-group">
              <span>{t('inspector.prebuilt')}</span>
            </div>
            {voices.map((v) => (
              <label key={v.name} className="voice-option">
                <input type="radio" name="voice" value={v.name} checked={voice === v.name} onChange={() => update({ voice: v.name })} />
                <VoiceOrb seed={v.name} size={26} />
                <span>
                  <span className="voice-name">{v.name}</span>
                  <span className="voice-desc">{v.descriptor}</span>
                </span>
                <span className="voice-gender">{t(`inspector.gender.${v.gender}`)}</span>
                <PreviewButton target={{ voiceId: v.name, name: v.name }} />
              </label>
            ))}
          </div>
        </div>

        <div className="inspector-section">
          <label className="field-label" htmlFor="style-input">
            {t('inspector.style')}{' '}
            <span className="counter">
              {style.length} / {MAX_STYLE_CHARS}
            </span>
          </label>
          <textarea
            id="style-input"
            className="input"
            rows={3}
            maxLength={MAX_STYLE_CHARS}
            value={style}
            placeholder={t('inspector.stylePlaceholder')}
            onChange={(e) => update({ style: e.target.value })}
          />
          <p className="help">{t('inspector.styleHint')}</p>
          <div className="style-examples">
            {styleExamples.map((example) => (
              <button key={example} type="button" className="chip" aria-pressed={style === example} onClick={() => update({ style: example })}>
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="inspector-section" role="group" aria-labelledby="model-heading">
          <p className="field-label" id="model-heading">
            {t('inspector.model')}
          </p>
          <div className="segmented">
            <label>
              <input type="radio" name="model" checked={model === 'gemini-3.8-flash-tts'} onChange={() => update({ model: 'gemini-3.8-flash-tts' })} />
              {t('inspector.model.flash')}
            </label>
            <label>
              <input type="radio" name="model" checked={model === 'gemini-3.8-flash-lite-tts'} onChange={() => update({ model: 'gemini-3.8-flash-lite-tts' })} />
              {t('inspector.model.lite')}
            </label>
          </div>
          <p className="help">{model === 'gemini-3.8-flash-tts' ? t('inspector.model.flashHint') : t('inspector.model.liteHint')}</p>
        </div>
      </aside>
    </>
  );
}
