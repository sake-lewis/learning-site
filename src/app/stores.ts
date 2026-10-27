import { create } from 'zustand';

// ---------- Player: the one clip loaded in the bottom bar ----------

export interface Clip {
  id: string;
  blob: Blob;
  title: string;
  /** Second line in the player (e.g. the text or the chapter). */
  subtitle?: string;
  /** Voice id used to draw the tone disc next to the title. */
  seed?: string;
  fileName: string;
  seconds: number;
}

interface PlayerState {
  clip: Clip | null;
  autoplayId: string | null;
  load: (clip: Clip, autoplay?: boolean) => void;
  clear: () => void;
}

export const usePlayer = create<PlayerState>((set) => ({
  clip: null,
  autoplayId: null,
  load: (clip, autoplay = false) => set({ clip, autoplayId: autoplay ? clip.id : null }),
  clear: () => set({ clip: null, autoplayId: null }),
}));

// ---------- Toasts ----------

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
}

let nextToastId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, text) => {
    const id = nextToastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 8000 : 5000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

// ---------- Script draft, kept while switching pages (project autosave arrives in Phase 2) ----------

interface DraftState {
  text: string;
  setText: (text: string) => void;
}

export const useDraft = create<DraftState>((set) => ({
  text: '',
  setText: (text) => set({ text }),
}));

// ---------- Connection status shown in the sidebar ----------

interface ConnectionState {
  keyPresent: boolean | null;
  setKeyPresent: (value: boolean | null) => void;
}

export const useConnection = create<ConnectionState>((set) => ({
  keyPresent: null,
  setKeyPresent: (keyPresent) => set({ keyPresent }),
}));
