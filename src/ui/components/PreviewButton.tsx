// Small ▶ button that plays a voice with a predefined test sentence (cached after the first time).
import { useT } from '../../app/i18n.ts';
import { usePreviewState, useVoicePreview, type PreviewTarget } from '../../app/previews.ts';
import { PlayIcon } from '../icons.tsx';

export function PreviewButton({ target }: { target: PreviewTarget }) {
  const t = useT();
  const preview = useVoicePreview();
  const loadingId = usePreviewState((s) => s.loadingId);
  const busy = loadingId === target.voiceId;
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon btn-sm preview-btn${busy ? ' busy' : ''}`}
      onClick={(e) => {
        // Inside a <label>: play the preview without selecting the voice.
        e.preventDefault();
        void preview(target);
      }}
      disabled={loadingId !== null}
      aria-label={`${t('preview.listen')} : ${target.name}`}
      title={busy ? t('preview.loading') : t('preview.listen')}
    >
      <PlayIcon />
    </button>
  );
}
