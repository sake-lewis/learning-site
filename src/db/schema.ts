// IndexedDB data model, spec 7.4. Phase 1 writes takes, history and settings; the other stores
// are declared now so later phases add data without a schema migration.
import Dexie, { type EntityTable } from 'dexie';
import type { TtsModel } from '../../shared/models.ts';

export type Lang = 'fr' | 'en';

export interface Project {
  id: string;
  name: string;
  script: string;
  presetId: string | null;
  styleOverride: string;
  lexiconId: string | null;
  master: { targetLufs: number; timbreMatch: boolean; sentenceGapMs: number; paragraphGapMs: number };
  createdAt: number;
  updatedAt: number;
}

export interface Segment {
  id: string;
  projectId: string;
  index: number;
  text: string;
  style: string;
  status: 'queued' | 'generating' | 'qa' | 'ready' | 'review' | 'failed';
  chosenTakeId: string | null;
  locked: boolean;
}

export interface Take {
  id: string;
  segmentId: string | null;
  wav: Blob;
  durationMs: number;
  wer: number | null;
  judgeScore: number | null;
  flags: string[];
  model: TtsModel;
  voiceId: string;
  createdAt: number;
}

/** Form values of the persona builder (spec 4.8), kept so a voice can be redesigned later. */
export interface PersonaBuilder {
  gender: 'female' | 'male' | 'neutral';
  age: 'young' | 'adult' | 'mature' | 'senior';
  languageCode: string;
  accent: string;
  timbres: string[];
  delivery: string;
  freeText: string;
}

export interface VoicePreset {
  id: string;
  name: string;
  source: 'prebuilt' | 'library' | 'designed' | 'replicated';
  /** Google voice id (`voice_…`) or prebuilt name used for synthesis. */
  voiceId: string;
  gender: 'female' | 'male' | 'neutral' | null;
  languageCode: string | null;
  accent: string;
  /** Prompt sent to Google; for a remixed voice, the original prompt plus each change. */
  prompt: string;
  builder: PersonaBuilder | null;
  styleLine: string;
  sample: Blob | null;
  eqCurve: number[];
  matchScore: number | null;
  fingerprint: Record<string, number> | null;
  consent?: { date: number; locale: string; sha256Source: string; sha256Consent: string };
  createdAt: number;
  updatedAt: number;
}

export interface Lexicon {
  id: string;
  name: string;
  entries: { term: string; say: string; caseSensitive: boolean }[];
}

export interface HistoryEntry {
  id: string;
  projectId: string | null;
  takeId: string;
  textPreview: string;
  voiceId: string;
  style: string;
  model: TtsModel;
  durationMs: number;
  qa: string | null;
  createdAt: number;
}

/** An audiobook (spec F16): the source text, its voice settings and the generation state. */
export interface Book {
  id: string;
  title: string;
  voiceId: string;
  voiceName: string;
  style: string;
  model: TtsModel;
  readTitles: boolean;
  chapters: { title: string; segmentCount: number }[];
  characters: number;
  status: 'ready' | 'running' | 'paused' | 'done';
  /** Why the book is paused: the user, the free-tier quota, or an error (code + Google's detail). */
  pause: { reason: 'user' | 'quota' | 'error'; code: string; detail: string | null; resumeAfter: number | null } | null;
  createdAt: number;
  updatedAt: number;
}

export interface BookSegment {
  id: string;
  bookId: string;
  chapterIndex: number;
  /** Order in the whole book. */
  index: number;
  text: string;
  status: 'pending' | 'done' | 'failed';
  wav: Blob | null;
  seconds: number;
  attempts: number;
  error: string | null;
}

/** A cached voice preview (spec F5), so listening again never spends free-tier quota. */
export interface VoicePreview {
  key: string;
  voiceId: string;
  lang: Lang;
  model: TtsModel;
  text: string;
  wav: Blob;
  createdAt: number;
}

export interface SettingsRow {
  id: 'settings';
  lang: Lang;
  defaultModel: TtsModel;
  lastVoice: string;
  lastStyle: string;
}

export const db = new Dexie('timbre-studio') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  segments: EntityTable<Segment, 'id'>;
  takes: EntityTable<Take, 'id'>;
  voicePresets: EntityTable<VoicePreset, 'id'>;
  lexicons: EntityTable<Lexicon, 'id'>;
  history: EntityTable<HistoryEntry, 'id'>;
  settings: EntityTable<SettingsRow, 'id'>;
  previews: EntityTable<VoicePreview, 'key'>;
  books: EntityTable<Book, 'id'>;
  bookSegments: EntityTable<BookSegment, 'id'>;
};

db.version(1).stores({
  projects: 'id, updatedAt',
  segments: 'id, projectId, [projectId+index]',
  takes: 'id, segmentId, createdAt',
  voicePresets: 'id, name',
  lexicons: 'id, name',
  history: 'id, projectId, createdAt',
  settings: 'id',
});

// Phase 2: saved voices are listed newest first and looked up by Google voice id.
db.version(2).stores({
  voicePresets: 'id, name, voiceId, createdAt',
});

// Voice previews cached per voice, language and model.
db.version(3).stores({
  previews: 'key, voiceId, createdAt',
});

// Audiobooks and their segments, read in book order.
db.version(4).stores({
  books: 'id, createdAt',
  bookSegments: 'id, bookId, [bookId+index]',
});
