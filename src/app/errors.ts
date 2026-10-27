import { parseWav } from '../../shared/wav.ts';
import { ApiError } from './api.ts';
import { errorKey, type MessageKey } from './i18n.ts';
import { quotaResetLabel } from './quota.ts';
import type { Clip } from './stores.ts';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Translated message for a failed call; Voice Lab errors also show Google's own reason. */
export function errorText(t: Translate, error: unknown, withDetail = false): string {
  if (!(error instanceof ApiError)) return t('error.generic');
  const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const base = t(errorKey(error.code), { time: quotaResetLabel(lang) });
  return withDetail && error.detail ? `${base} ${t('error.detail', { detail: error.detail })}` : base;
}

export async function clipFromWav(id: string, blob: Blob, title: string, fileName: string): Promise<Clip> {
  let seconds = 0;
  try {
    // The header is enough: a long chapter is never loaded just to read its duration.
    seconds = parseWav(new Uint8Array(await blob.slice(0, 4096).arrayBuffer()), blob.size).durationSec;
  } catch {
    // Unknown layout: the player still plays it, only the time display stays at 0.
  }
  return { id, blob, title, fileName, seconds };
}
