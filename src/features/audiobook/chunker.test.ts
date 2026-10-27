import { describe, expect, it } from 'vitest';
import { detectChapters, isHeading, planBook, planSegments, SEGMENT_MAX_CHARS, toParagraphs } from './chunker.ts';

describe('toParagraphs', () => {
  it('re-joins lines hard-wrapped inside a sentence and keeps paragraph breaks', () => {
    const raw = 'Il était une fois un village\nperdu dans la montagne.\n\nLe matin, il pleuvait.\r\nLe soir, il neigeait.';
    expect(toParagraphs(raw)).toEqual(['Il était une fois un village perdu dans la montagne.', 'Le matin, il pleuvait.', 'Le soir, il neigeait.']);
  });

  it('drops page numbers and joins words split by a hyphen at the line end', () => {
    expect(toParagraphs('Une phrase qui con-\ntinue ici.\n12\nPage 13\nSuite du texte.')).toEqual(['Une phrase qui continue ici.', 'Suite du texte.']);
  });
});

describe('chapters', () => {
  it('recognises common headings', () => {
    expect(isHeading('Chapitre 3 : La tempête')).toBe(true);
    expect(isHeading('# Prologue')).toBe(true);
    expect(isHeading('IV.')).toBe(true);
    expect(isHeading('Chaque matin, la ville s’éveille.')).toBe(false);
  });

  it('recognises numbered and standalone headings in French and English', () => {
    const headings = [
      'Chapitre III',
      'CHAPITRE PREMIER',
      'Chapitre 1er',
      'Chapitre vingt-et-un',
      'Chapitre trente et un – Le retour',
      'Chapitre 3 : La tempête',
      'Partie 2',
      'Livre premier',
      'Chapter One: Beginnings',
      'Chapter 12. The storm',
      'Chapter 4 The Boy Who Lived',
      'Part II',
      'Book Twenty-One',
      'Prologue',
      'Épilogue : la fin',
      'INTRODUCTION',
      'Avant-propos',
    ];
    for (const heading of headings) expect(isHeading(heading), heading).toBe(true);
  });

  it('does not take a short sentence starting with a heading word for a chapter', () => {
    const sentences = [
      'Partie remise, dit-il.',
      'Part of me wanted to stay.',
      'Part one of the plan failed.',
      'Livre-moi ça demain.',
      'Livre civil.',
      'Book it now!',
      "Introduction faite, il s'assit.",
      'Conclusion de l’affaire : rien.',
      'Chapitre clos, passons.',
    ];
    for (const sentence of sentences) expect(isHeading(sentence), sentence).toBe(false);
  });

  it('keeps dialogue that starts with a heading word inside its chapter', () => {
    const plan = planBook('Chapitre 1\n\nIl joua aux cartes toute la nuit.\n\nPartie remise, dit-il.\n\nIl rentra chez lui.\n\nChapitre 2\n\nLe lendemain.', 'Livre', false);
    expect(plan.chapters.map((c) => [c.title, c.paragraphs.length])).toEqual([
      ['Chapitre 1', 3],
      ['Chapitre 2', 1],
    ]);
  });

  it('groups paragraphs under headings and keeps text before the first heading', () => {
    const chapters = detectChapters(['Avant-texte.', 'Chapitre 1', 'Un.', 'Deux.', 'Chapitre 2', 'Trois.'], 'Mon livre');
    expect(chapters.map((c) => [c.title, c.paragraphs.length])).toEqual([
      ['Mon livre', 1],
      ['Chapitre 1', 2],
      ['Chapitre 2', 1],
    ]);
  });
});

describe('planSegments', () => {
  const paragraph = (n: number) => `${'Phrase de test assez longue pour remplir. '.repeat(n).trim()}`;

  it('never exceeds the maximum segment size and loses no text', () => {
    const chapters = [{ title: 'Chapitre 1', paragraphs: [paragraph(30), paragraph(200), paragraph(5)] }];
    const segments = planSegments(chapters, false);
    expect(segments.every((s) => s.text.length <= SEGMENT_MAX_CHARS)).toBe(true);
    const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
    expect(segments.reduce((sum, s) => sum + words(s.text), 0)).toBe(chapters[0]!.paragraphs.reduce((sum, p) => sum + words(p), 0));
  });

  it('starts each chapter with its title and a pause when asked', () => {
    const segments = planSegments([{ title: 'Chapitre 1', paragraphs: ['Texte.'] }, { title: 'Chapitre 2', paragraphs: ['Suite.'] }], true);
    expect(segments.map((s) => [s.chapterIndex, s.text])).toEqual([
      [0, 'Chapitre 1. <long pause>\n\nTexte.'],
      [1, 'Chapitre 2. <long pause>\n\nSuite.'],
    ]);
  });

  it('plans a 40-page book in a few dozen requests', () => {
    const page = `${'Le voyageur avançait lentement sur la route, observant les champs et les collines. '.repeat(22)}\n\n`;
    const book = planBook(`Chapitre 1\n\n${page.repeat(20)}Chapitre 2\n\n${page.repeat(20)}`, 'Livre', true);
    expect(book.chapters).toHaveLength(2);
    expect(book.pages).toBeGreaterThanOrEqual(38);
    expect(book.segments.length).toBeLessThanOrEqual(40);
  });
});
