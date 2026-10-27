import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickPreviewText, PREVIEW_TEXTS, previewLang } from '../voices/previewTexts.ts';
import { isDailyQuota, isRunning, startBook, useRunner } from './runner.ts';

describe('startBook', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports another tab holding the queue lock, without showing the book as running', async () => {
    const request = vi.fn(async (_name: string, _options: unknown, callback: (lock: null) => unknown) => callback(null));
    vi.stubGlobal('navigator', { locks: { request } });
    const phases: string[] = [];
    const unsubscribe = useRunner.subscribe((state) => phases.push(state.phase));

    expect(await startBook('book-1')).toBe('other-tab');
    unsubscribe();

    expect(request).toHaveBeenCalledWith('timbre-audiobook-runner', { ifAvailable: true }, expect.any(Function));
    expect(phases).not.toContain('generating');
    expect(useRunner.getState().phase).toBe('idle');
    expect(isRunning()).toBe(false);
  });

  it('refuses a second start in the same tab while the first is pending', async () => {
    let grant: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      grant = resolve;
    });
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, callback: (lock: null) => unknown) => pending.then(() => callback(null)) } });

    const first = startBook('book-1');
    expect(isRunning()).toBe(true);
    expect(await startBook('book-2')).toBe('busy-here');
    grant(undefined);
    expect(await first).toBe('other-tab');
    expect(isRunning()).toBe(false);
  });
});

describe('isDailyQuota', () => {
  it('recognises per-day quota messages from Google', () => {
    expect(isDailyQuota('Quota exceeded for metric: generate_requests_per_model_per_day, limit: 100')).toBe(true);
    expect(isDailyQuota('GenerateRequestsPerDayPerProjectPerModel-FreeTier')).toBe(true);
    expect(isDailyQuota('Daily limit reached')).toBe(true);
  });

  it('treats per-minute or unknown quota messages as waitable', () => {
    expect(isDailyQuota('Quota exceeded for metric: generate_requests_per_model_per_minute')).toBe(false);
    expect(isDailyQuota(null)).toBe(false);
    expect(isDailyQuota(undefined)).toBe(false);
  });
});

describe('preview texts', () => {
  it('picks a sentence different from the previous one', () => {
    const previous = PREVIEW_TEXTS.fr[0];
    for (let i = 0; i < 20; i++) expect(pickPreviewText('fr', previous)).not.toBe(previous);
    expect(PREVIEW_TEXTS.en).toContain(pickPreviewText('en', undefined, () => 0.99));
  });

  it('uses the voice language when known, else the interface language', () => {
    expect(previewLang('fr-CA', 'en')).toBe('fr');
    expect(previewLang('en-GB', 'fr')).toBe('en');
    expect(previewLang('es-ES', 'fr')).toBe('fr');
    expect(previewLang(null, 'en')).toBe('en');
  });
});
