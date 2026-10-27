// The 30 prebuilt Gemini TTS voices with Google's one-word descriptor (spec section 2).
// Gender follows Google's catalogue naming; the Extended Library (Phase 5) supplies richer metadata.

export type Gender = 'female' | 'male';

export interface PrebuiltVoice {
  name: string;
  descriptor: string;
  gender: Gender;
}

export const PREBUILT_VOICES: readonly PrebuiltVoice[] = [
  { name: 'Achernar', descriptor: 'Soft', gender: 'female' },
  { name: 'Achird', descriptor: 'Friendly', gender: 'male' },
  { name: 'Algenib', descriptor: 'Gravelly', gender: 'male' },
  { name: 'Algieba', descriptor: 'Smooth', gender: 'male' },
  { name: 'Alnilam', descriptor: 'Firm', gender: 'male' },
  { name: 'Aoede', descriptor: 'Breezy', gender: 'female' },
  { name: 'Autonoe', descriptor: 'Bright', gender: 'female' },
  { name: 'Callirrhoe', descriptor: 'Easy-going', gender: 'female' },
  { name: 'Charon', descriptor: 'Informative', gender: 'male' },
  { name: 'Despina', descriptor: 'Smooth', gender: 'female' },
  { name: 'Enceladus', descriptor: 'Breathy', gender: 'male' },
  { name: 'Erinome', descriptor: 'Clear', gender: 'female' },
  { name: 'Fenrir', descriptor: 'Excitable', gender: 'male' },
  { name: 'Gacrux', descriptor: 'Mature', gender: 'female' },
  { name: 'Iapetus', descriptor: 'Clear', gender: 'male' },
  { name: 'Kore', descriptor: 'Firm', gender: 'female' },
  { name: 'Laomedeia', descriptor: 'Upbeat', gender: 'female' },
  { name: 'Leda', descriptor: 'Youthful', gender: 'female' },
  { name: 'Orus', descriptor: 'Firm', gender: 'male' },
  { name: 'Pulcherrima', descriptor: 'Forward', gender: 'female' },
  { name: 'Puck', descriptor: 'Upbeat', gender: 'male' },
  { name: 'Rasalgethi', descriptor: 'Informative', gender: 'male' },
  { name: 'Sadachbia', descriptor: 'Lively', gender: 'male' },
  { name: 'Sadaltager', descriptor: 'Knowledgeable', gender: 'male' },
  { name: 'Schedar', descriptor: 'Even', gender: 'male' },
  { name: 'Sulafat', descriptor: 'Warm', gender: 'female' },
  { name: 'Umbriel', descriptor: 'Easy-going', gender: 'male' },
  { name: 'Vindemiatrix', descriptor: 'Gentle', gender: 'female' },
  { name: 'Zephyr', descriptor: 'Bright', gender: 'female' },
  { name: 'Zubenelgenubi', descriptor: 'Casual', gender: 'male' },
];

export const PREBUILT_VOICE_NAMES = PREBUILT_VOICES.map((v) => v.name) as [string, ...string[]];

export const DEFAULT_VOICE = 'Kore';
