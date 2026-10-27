import { describe, expect, it } from 'vitest';
import { MESSAGE_KEYS, translate } from './i18n.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n tables', () => {
  it('gives every message the same placeholders in French and English', () => {
    const mismatches = MESSAGE_KEYS.filter((key) => placeholders(translate('en', key)).join() !== placeholders(translate('fr', key)).join());
    expect(mismatches).toEqual([]);
  });

  it('leaves no message empty', () => {
    const empty = MESSAGE_KEYS.filter((key) => !translate('en', key).trim() || !translate('fr', key).trim());
    expect(empty).toEqual([]);
  });

  it('fills placeholders', () => {
    expect(translate('fr', 'recent.retention', { days: 30 })).toBe('Les générations sont conservées 30 jours, puis effacées de ce PC.');
    expect(translate('en', 'clone.tooBig', { mb: 20 })).toBe('This file is too large: 20 MB at most.');
  });
});
