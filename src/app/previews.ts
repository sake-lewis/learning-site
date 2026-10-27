// Voice previews (spec F5): a predefined sentence spoken by any voice, generated once and cached.
import { useCallback } from 'react';
import { create } from 'zustand';
import { db } from '../db/schema.ts';
import { pickPreviewText, previewLang } from '../features/voices/previewTexts.ts';
import { ApiError, synthesize } from './api.ts';
import { clipFromWav, errorText } from './errors.ts';
import { useT } from './i18n.ts';
import { useSettings } from './settings.ts';
import { usePlayer, useToasts } from './stores.ts';

interface PreviewState {
  loadingId: string | null;
  setLoading: (id: string | null) => void;
}

export const usePreviewState = create<PreviewState>((set) => ({
  loadingId: null,
  setLoading: (loadingId) => set({ loadingId }),
}));

export interface PreviewTarget {
  voiceId: string;
  name: string;
  languageCode?: string | null;
}

/** Returns `preview(target, fresh)`: plays the cached preview, or generates one with a new sentence. */
export function useVoicePreview() {
  const t = useT();
  const uiLang = useSettings((s) => s.lang);
  const model = useSettings((s) => s.model);
  const load = usePlayer((s) => s.load);
  const toast = useToasts((s) => s.push);
  const setLoading = usePreviewState((s) => s.setLoading);

  return useCallback(
    async (target: PreviewTarget, fresh = false) => {
      if (usePreviewState.getState().loadingId) return;
      const lang = previewLang(target.languageCode, uiLang);
      const key = `${target.voiceId}|${lang}|${model}`;
      const title = target.name;
      const fileName = `extrait-${target.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}.wav`;
      setLoading(target.voiceId);
      try {
        const cached = await db.previews.get(key).catch(() => undefined);
        if (cached && !fresh) {
          load({ ...(await clipFromWav(key, cached.wav, title, fileName)), subtitle: `${t('preview.title')} : ${cached.text}`, seed: target.voiceId }, true);
          return;
        }
        const text = pickPreviewText(lang, cached?.text);
        const result = await synthesize({ text, style: '', voice: target.voiceId, model }, new AbortController().signal);
        await db.previews.put({ key, voiceId: target.voiceId, lang, model, text, wav: result.blob, createdAt: Date.now() }).catch(() => undefined);
        load({ id: `${key}|${Date.now()}`, blob: result.blob, title, subtitle: `${t('preview.title')} : ${text}`, seed: target.voiceId, fileName, seconds: result.seconds }, true);
      } catch (error) {
        if (!(error instanceof ApiError && error.code === 'CANCELLED')) toast('error', errorText(t, error, true));
      } finally {
        setLoading(null);
      }
    },
    [uiLang, model, load, toast, setLoading, t],
  );
}
