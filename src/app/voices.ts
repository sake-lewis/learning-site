// Saved voices (My voices), shared by the Voice Lab and the TTS voice picker.
import { create } from 'zustand';
import { PREBUILT_VOICES } from '../../shared/voices.ts';
import { db, type VoicePreset } from '../db/schema.ts';

interface VoicesState {
  presets: VoicePreset[];
  refresh: () => Promise<void>;
}

export const useVoices = create<VoicesState>((set) => ({
  presets: [],
  refresh: async () => {
    try {
      set({ presets: await db.voicePresets.orderBy('createdAt').reverse().toArray() });
    } catch {
      set({ presets: [] });
    }
  },
}));

/** Display name for a voice id: a saved voice's name, a prebuilt name, or the raw id. */
export function voiceLabel(voiceId: string, presets: VoicePreset[]): string {
  return presets.find((p) => p.voiceId === voiceId)?.name ?? PREBUILT_VOICES.find((v) => v.name === voiceId)?.name ?? voiceId;
}

export async function savePreset(preset: VoicePreset): Promise<void> {
  await db.voicePresets.put(preset);
  await useVoices.getState().refresh();
}

export async function removePreset(id: string): Promise<void> {
  await db.voicePresets.delete(id);
  await useVoices.getState().refresh();
}
