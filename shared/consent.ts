// Consent statements required by Google for voice replication (voice-replication guide, checked 2026-10-27).
// Only the locales whose exact wording was verified are offered in the app.

export const CONSENT_STATEMENTS = {
  'fr-FR': "Je suis le propriétaire de cette voix et j'autorise Google à utiliser cette voix pour créer un modèle de voix synthétique.",
  'fr-CA': "Je suis le propriétaire de cette voix et j'autorise Google à utiliser cette voix pour créer un modèle de voix synthétique.",
  'en-US': 'I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.',
  'en-GB': 'I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.',
} as const;

export type ConsentLocale = keyof typeof CONSENT_STATEMENTS;

export const CONSENT_LOCALES = Object.keys(CONSENT_STATEMENTS) as [ConsentLocale, ...ConsentLocale[]];

/** Reference clip limits from the guide: 10-30 s of one adult speaker; consent clip up to 30 s. */
export const CLONE_LIMITS = { minSourceSec: 10, maxSourceSec: 30, minConsentSec: 2, maxConsentSec: 30 } as const;

/** Imported reference files (spec S6), checked before decoding so a huge file never fills memory. */
export const UPLOAD_LIMITS = { maxBytes: 20 * 1024 * 1024, maxSec: 180 } as const;
