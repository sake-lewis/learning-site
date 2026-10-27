// Persona builder (spec 4.8): form choices shown in French or English, merged into one or two
// English sentences for Google's `prompted.input`. Free text and custom accents pass through as typed.
import type { PersonaBuilder } from '../../db/schema.ts';

interface Choice {
  id: string;
  fr: string;
  en: string;
  /** Wording used inside the English prompt. */
  prompt: string;
}

export const AGES: Choice[] = [
  { id: 'young', fr: 'Jeune adulte (20-30 ans)', en: 'Young adult (20s)', prompt: 'young adult' },
  { id: 'adult', fr: 'Adulte (30-45 ans)', en: 'Adult (30s to mid-40s)', prompt: 'adult' },
  { id: 'mature', fr: 'Mûr (45-60 ans)', en: 'Mature (late 40s to 50s)', prompt: 'mature' },
  { id: 'senior', fr: 'Senior (60 ans et plus)', en: 'Senior (60+)', prompt: 'senior' },
];

export const LANGUAGES: Choice[] = [
  { id: 'fr-FR', fr: 'Français (France)', en: 'French (France)', prompt: 'French' },
  { id: 'fr-CA', fr: 'Français (Québec)', en: 'French (Québec)', prompt: 'Canadian French' },
  { id: 'fr-BE', fr: 'Français (Belgique)', en: 'French (Belgium)', prompt: 'Belgian French' },
  { id: 'fr-CH', fr: 'Français (Suisse)', en: 'French (Switzerland)', prompt: 'Swiss French' },
  { id: 'en-US', fr: 'Anglais (États-Unis)', en: 'English (US)', prompt: 'American English' },
  { id: 'en-GB', fr: 'Anglais (Royaume-Uni)', en: 'English (UK)', prompt: 'British English' },
  { id: 'es-ES', fr: 'Espagnol (Espagne)', en: 'Spanish (Spain)', prompt: 'Spanish' },
  { id: 'de-DE', fr: 'Allemand', en: 'German', prompt: 'German' },
  { id: 'it-IT', fr: 'Italien', en: 'Italian', prompt: 'Italian' },
  { id: 'pt-BR', fr: 'Portugais (Brésil)', en: 'Portuguese (Brazil)', prompt: 'Brazilian Portuguese' },
];

export const ACCENTS: Choice[] = [
  { id: 'neutral-fr', fr: 'Parisien neutre', en: 'Neutral Parisian', prompt: 'neutral Parisian French' },
  { id: 'south-fr', fr: 'Du Sud de la France', en: 'Southern France', prompt: 'warm Southern French (Provence)' },
  { id: 'quebec', fr: 'Québécois', en: 'Québécois', prompt: 'Québécois' },
  { id: 'belgian', fr: 'Belge', en: 'Belgian', prompt: 'Belgian' },
  { id: 'swiss', fr: 'Suisse romand', en: 'Swiss French', prompt: 'Swiss French' },
  { id: 'west-africa', fr: 'Africain francophone', en: 'West African French', prompt: 'West African French' },
  { id: 'caribbean', fr: 'Antillais', en: 'French Caribbean', prompt: 'French Caribbean' },
  { id: 'alsace', fr: 'Alsacien', en: 'Alsatian', prompt: 'Alsatian' },
  { id: 'british', fr: 'Britannique', en: 'British', prompt: 'British' },
  { id: 'american', fr: 'Américain', en: 'American', prompt: 'American' },
];

export const TIMBRES: Choice[] = [
  { id: 'deep', fr: 'grave', en: 'deep', prompt: 'deep' },
  { id: 'warm', fr: 'chaude', en: 'warm', prompt: 'warm' },
  { id: 'clear', fr: 'claire', en: 'clear', prompt: 'clear' },
  { id: 'soft', fr: 'douce', en: 'soft', prompt: 'soft' },
  { id: 'bright', fr: 'brillante', en: 'bright', prompt: 'bright' },
  { id: 'husky', fr: 'voilée', en: 'husky', prompt: 'husky' },
  { id: 'raspy', fr: 'rauque', en: 'raspy', prompt: 'raspy' },
  { id: 'powerful', fr: 'puissante', en: 'powerful', prompt: 'powerful, resonant' },
  { id: 'velvety', fr: 'feutrée', en: 'velvety', prompt: 'velvety' },
  { id: 'breathy', fr: 'soufflée', en: 'breathy', prompt: 'breathy' },
];

export const DELIVERIES: Choice[] = [
  { id: 'calm', fr: 'Posé', en: 'Calm', prompt: 'calm, measured' },
  { id: 'warm', fr: 'Chaleureux', en: 'Warm', prompt: 'warm, friendly' },
  { id: 'energetic', fr: 'Énergique', en: 'Energetic', prompt: 'energetic, upbeat' },
  { id: 'authoritative', fr: 'Autoritaire', en: 'Authoritative', prompt: 'authoritative, confident' },
  { id: 'intimate', fr: 'Intime', en: 'Intimate', prompt: 'intimate, close-to-the-mic' },
  { id: 'playful', fr: 'Enjoué', en: 'Playful', prompt: 'playful, smiling' },
  { id: 'news', fr: 'Présentateur', en: 'Newsreader', prompt: 'neutral, newsreader-style' },
];

export const MAX_TIMBRES = 3;

const GENDER_WORD = { female: 'female', male: 'male', neutral: 'gender-neutral' } as const;

function find(list: Choice[], id: string): Choice | undefined {
  return list.find((c) => c.id === id);
}

/** An accent typed as one of the suggestion labels uses its English wording; anything else passes through. */
function accentWording(accent: string): string {
  const typed = accent.trim();
  const match = ACCENTS.find((c) => [c.fr, c.en, c.id].some((label) => label.toLowerCase() === typed.toLowerCase()));
  return match ? match.prompt : typed;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function composePrompt(builder: PersonaBuilder): string {
  const age = find(AGES, builder.age)?.prompt ?? 'adult';
  const language = find(LANGUAGES, builder.languageCode)?.prompt ?? builder.languageCode;
  const accent = accentWording(builder.accent);
  const timbres = builder.timbres
    .map((id) => find(TIMBRES, id)?.prompt)
    .filter(Boolean)
    .slice(0, MAX_TIMBRES);
  const delivery = find(DELIVERIES, builder.delivery)?.prompt;

  const article = /^[aeiou]/i.test(age) ? 'An' : 'A';
  let first = `${article} ${age} ${GENDER_WORD[builder.gender]} voice speaking ${language}`;
  if (accent) first += ` with a ${accent} accent`;
  if (timbres.length > 0) first += `; ${timbres.join(', ')} timbre`;
  if (delivery) first += `, with a ${delivery} delivery`;
  return [sentence(first), sentence(builder.freeText)].filter(Boolean).join(' ');
}

/** Full description used when Google refuses a remix: the original prompt plus the requested change. */
export function mergeRemixPrompt(originalPrompt: string, change: string): string {
  return [sentence(originalPrompt), sentence(`Change: ${change}`)].filter(Boolean).join(' ');
}

export function choiceLabel(list: Choice[], id: string, lang: 'fr' | 'en'): string {
  const choice = find(list, id);
  return choice ? choice[lang] : id;
}

export const DEFAULT_BUILDER: PersonaBuilder = {
  gender: 'female',
  age: 'adult',
  languageCode: 'fr-FR',
  accent: '',
  timbres: [],
  delivery: 'calm',
  freeText: '',
};
