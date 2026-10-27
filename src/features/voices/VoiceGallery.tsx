// Google voices (spec F5): every prebuilt voice with its tone disc, a test sentence, Use and Variant.
import { useState } from 'react';
import { PREBUILT_VOICES, type Gender } from '../../../shared/voices.ts';
import { useT } from '../../app/i18n.ts';
import { usePreviewState, useVoicePreview } from '../../app/previews.ts';
import { useSettings } from '../../app/settings.ts';
import { EqLoader } from '../../ui/components/Brand.tsx';
import { VoiceOrb } from '../../ui/components/VoiceOrb.tsx';
import { PlayIcon, RefreshIcon } from '../../ui/icons.tsx';

interface VoiceGalleryProps {
  onUse: (voiceName: string) => void;
  onVariant: (voiceName: string) => void;
}

export function VoiceGallery({ onUse, onVariant }: VoiceGalleryProps) {
  const t = useT();
  const current = useSettings((s) => s.voice);
  const preview = useVoicePreview();
  const loadingId = usePreviewState((s) => s.loadingId);
  const [filter, setFilter] = useState<'all' | Gender>('all');
  const voices = PREBUILT_VOICES.filter((v) => filter === 'all' || v.gender === filter);

  return (
    <div className="stack">
      <div className="page-head" style={{ alignItems: 'center' }}>
        <p className="page-sub" style={{ margin: 0 }}>
          {t('gallery.intro')}
        </p>
        <div className="segmented" style={{ minWidth: 280 }}>
          {(['all', 'female', 'male'] as const).map((value) => (
            <label key={value}>
              <input type="radio" name="gallery-filter" checked={filter === value} onChange={() => setFilter(value)} />
              {t(`inspector.filter.${value}`)}
            </label>
          ))}
        </div>
      </div>
      <ul className="gallery">
        {voices.map((v) => {
          const busy = loadingId === v.name;
          return (
            <li key={v.name} className={`gallery-row${current === v.name ? ' current' : ''}`}>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 48, height: 48, borderRadius: '50%', padding: 0 }}
                onClick={() => void preview({ voiceId: v.name, name: v.name })}
                disabled={loadingId !== null && !busy}
                aria-label={`${t('preview.listen')} : ${v.name}`}
                title={t('preview.listen')}
              >
                <VoiceOrb seed={v.name} size={40} />
              </button>
              <div style={{ minWidth: 0 }}>
                <p className="voice-card-name">{v.name}</p>
                <p className="meta-list">
                  <span>{v.descriptor}</span>
                  <span>{t(`gender.${v.gender}`)}</span>
                </p>
              </div>
              <div className="gallery-actions">
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => void preview({ voiceId: v.name, name: v.name })} disabled={loadingId !== null} aria-label={`${t('preview.listen')} : ${v.name}`} title={t('preview.listen')}>
                  {busy ? <EqLoader /> : <PlayIcon />}
                </button>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => void preview({ voiceId: v.name, name: v.name }, true)} disabled={loadingId !== null} aria-label={`${t('preview.another')} : ${v.name}`} title={t('preview.another')}>
                  <RefreshIcon />
                </button>
                <button type="button" className="btn btn-sm" onClick={() => onUse(v.name)}>
                  {t('mine.use')}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onVariant(v.name)} title={t('gallery.variant')}>
                  {t('gallery.variantShort')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
