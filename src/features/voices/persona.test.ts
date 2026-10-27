import { describe, expect, it } from 'vitest';
import { composePrompt, DEFAULT_BUILDER, mergeRemixPrompt } from './persona.ts';

describe('persona builder', () => {
  it('builds a full English description from the form', () => {
    const prompt = composePrompt({
      gender: 'male',
      age: 'mature',
      languageCode: 'fr-CA',
      accent: 'Québécois',
      timbres: ['deep', 'warm'],
      delivery: 'calm',
      freeText: 'Narrateur de documentaire nature, rassurant',
    });
    expect(prompt).toBe(
      'A mature male voice speaking Canadian French with a Québécois accent; deep, warm timbre, with a calm, measured delivery. Narrateur de documentaire nature, rassurant.',
    );
  });

  it('maps French accent labels and passes custom accents through', () => {
    expect(composePrompt({ ...DEFAULT_BUILDER, accent: 'du sud de la france', delivery: '' })).toBe(
      'An adult female voice speaking French with a warm Southern French (Provence) accent.',
    );
    expect(composePrompt({ ...DEFAULT_BUILDER, accent: 'marseillais', delivery: '' })).toContain('with a marseillais accent');
  });

  it('keeps at most three timbre words and skips empty parts', () => {
    const prompt = composePrompt({ ...DEFAULT_BUILDER, gender: 'neutral', timbres: ['deep', 'warm', 'clear', 'soft'], delivery: '' });
    expect(prompt).toBe('An adult gender-neutral voice speaking French; deep, warm, clear timbre.');
  });

  it('merges a remix change into the original prompt', () => {
    expect(mergeRemixPrompt('A calm female voice.', 'plus grave')).toBe('A calm female voice. Change: plus grave.');
  });
});
