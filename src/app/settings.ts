import { create } from 'zustand';
import type { TtsModel } from '../../shared/models.ts';
import { DEFAULT_VOICE } from '../../shared/voices.ts';
import { db, type Lang, type SettingsRow } from '../db/schema.ts';

interface SettingsState {
  lang: Lang;
  model: TtsModel;
  voice: string;
  style: string;
  update: (patch: Partial<Pick<SettingsState, 'lang' | 'model' | 'voice' | 'style'>>) => void;
}

const browserLang: Lang = navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';

export const useSettings = create<SettingsState>((set, get) => ({
  lang: browserLang,
  model: 'gemini-3.8-flash-tts',
  voice: DEFAULT_VOICE,
  style: '',
  update: (patch) => {
    set(patch);
    const s = get();
    const row: SettingsRow = { id: 'settings', lang: s.lang, defaultModel: s.model, lastVoice: s.voice, lastStyle: s.style };
    void db.settings.put(row).catch(() => undefined);
  },
}));

/** Loads saved settings before the first render; falls back to defaults if storage is unavailable. */
export async function loadSettings(): Promise<void> {
  try {
    const row = await db.settings.get('settings');
    // Rows saved before the dark-only change still hold a `theme` field: it is ignored and dropped on the next save.
    if (row) useSettings.setState({ lang: row.lang, model: row.defaultModel, voice: row.lastVoice, style: row.lastStyle });
  } catch {
    // Private mode or blocked storage: keep defaults.
  }
}
