// Predefined test sentences for voice previews (spec F5): varied registers so a voice can be judged
// on narration, advertising and teaching. About 8-12 seconds each.

export const PREVIEW_TEXTS: Record<'fr' | 'en', readonly string[]> = {
  fr: [
    "Bienvenue. Installez-vous confortablement : l'histoire que vous allez entendre commence au moment précis où tout bascule.",
    "Chaque matin, la ville s'éveille lentement. Les volets s'ouvrent, le café fume, et quelque part, une idée attend d'être racontée.",
    'Découvrez notre nouvelle collection : des matières naturelles, des lignes simples, et ce petit détail qui change tout.',
    "Au sommet de la montagne, le vent se tait. Devant nous, la vallée s'étend à perte de vue, baignée d'une lumière dorée.",
    'Dans ce chapitre, nous allons voir comment trois décisions simples peuvent transformer durablement votre façon de travailler.',
  ],
  en: [
    'Welcome. Make yourself comfortable: the story you are about to hear begins at the exact moment everything changes.',
    'Every morning, the city wakes up slowly. Shutters open, coffee steams, and somewhere, an idea is waiting to be told.',
    'Discover our new collection: natural materials, clean lines, and that one small detail that changes everything.',
    'At the top of the mountain, the wind falls silent. Below us, the valley stretches as far as the eye can see, bathed in golden light.',
    'In this chapter, we will see how three simple decisions can lastingly change the way you work.',
  ],
};

/** A random test sentence, different from `avoid` when possible. */
export function pickPreviewText(lang: 'fr' | 'en', avoid?: string, random: () => number = Math.random): string {
  const pool = PREVIEW_TEXTS[lang].filter((text) => text !== avoid);
  return pool[Math.floor(random() * pool.length)] ?? PREVIEW_TEXTS[lang][0] ?? '';
}

/** Preview language for a voice: its own language when known, otherwise the interface language. */
export function previewLang(languageCode: string | null | undefined, uiLang: 'fr' | 'en'): 'fr' | 'en' {
  if (languageCode?.startsWith('fr')) return 'fr';
  if (languageCode?.startsWith('en')) return 'en';
  return uiLang;
}
