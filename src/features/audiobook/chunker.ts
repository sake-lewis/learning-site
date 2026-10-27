// Audiobook text preparation (spec F16): clean a pasted or imported text, find chapters, and cut it
// into segments of about 2,500 characters at paragraph and sentence boundaries. Large segments keep
// the number of requests low on the free tier (a 40-page book is about 30 requests).

export const SEGMENT_TARGET_CHARS = 2500;
export const SEGMENT_MAX_CHARS = 3500;
export const CHARS_PER_PAGE = 1800;

export interface Chapter {
  title: string;
  paragraphs: string[];
}

export interface PlannedSegment {
  chapterIndex: number;
  text: string;
}

const SENTENCE_END = /[.!?…:;»"”)\]]$/;
const PAGE_NUMBER = /^(page\s*)?\d{1,4}$/i;

// Headings. A word alone is not enough ("Partie remise, dit-il." is dialogue, not a chapter):
// "Chapitre", "Part"… must be followed by a number, and "Prologue", "Introduction"… must stand alone
// or be followed by a separator ("Épilogue : la fin").
const NUMBERED_HEADING = /^(?:chapitre|chapter|partie|part|livre|book)\s+(.+)$/iu;
const STANDALONE_HEADING = /^(?:prologue|épilogue|epilogue|introduction|conclusion|avant-propos|préface|preface|postface)(?:\s*[.:—–-].*)?$/iu;
const NUMBER_WORD =
  'un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt|trente|quarante|cinquante|soixante|cent|premier|première|dernier|dernière|' +
  'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|first|last';
// "3", "1er", "12th", or spelled out: "premier", "vingt-et-un", "trente et un", "Twenty-One".
const NUMBER = new RegExp(`^(?:\\d{1,4}(?:er|re|e|ème|st|nd|rd|th)?|(?:${NUMBER_WORD})(?:[- ](?:et[- ])?(?:${NUMBER_WORD}))*)(?=$|[\\s.:—–-])`, 'iu');
// Upper-case Roman numerals only, so words such as "mix" or "civil" are not read as numbers.
const ROMAN = /^(?=[MDCLXVI])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})(?=$|[\s.:—–-])/u;

/** "Chapitre 3", "Part II : …", "Livre premier", "Chapter 12 The storm", but not "Part one of the plan failed." */
function isNumberedHeading(text: string): boolean {
  const after = NUMBERED_HEADING.exec(text)?.[1];
  if (!after) return false;
  const number = NUMBER.exec(after) ?? ROMAN.exec(after);
  if (!number) return false;
  const rest = after.slice(number[0].length).trim();
  // After the number: nothing, a separator and a title, or a title that is not a full sentence.
  return rest === '' || /^[.:—–-]/.test(rest) || !/[.!?…]$/.test(rest);
}

/**
 * Normalises line endings and spacing, drops page-number lines, and re-joins lines that were
 * hard-wrapped inside a sentence (common when copying from a PDF). Returns paragraphs.
 */
export function toParagraphs(raw: string): string[] {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '') // soft hyphens
    .replace(/[\t ]+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim());

  const paragraphs: string[] = [];
  let current = '';
  const flush = () => {
    if (current) paragraphs.push(current);
    current = '';
  };

  for (const line of lines) {
    if (!line || PAGE_NUMBER.test(line)) {
      if (!line) flush();
      continue;
    }
    if (!current) {
      current = line;
    } else if (/[a-zà-ÿ]-$/i.test(current)) {
      current = current.slice(0, -1) + line; // word split by a hyphen at the line end
    } else {
      current = `${current} ${line}`;
    }
    // A line that ends a sentence, or a heading, closes the paragraph even without a blank line.
    if (SENTENCE_END.test(line) || isHeading(line)) flush();
  }
  flush();
  return paragraphs;
}

export function isHeading(paragraph: string): boolean {
  const text = paragraph.trim();
  if (text.startsWith('#')) return text.replace(/^#+\s*/, '').length > 0 && text.length <= 120;
  return text.length <= 80 && (isNumberedHeading(text) || STANDALONE_HEADING.test(text) || /^[IVXLC]+\.?$/.test(text));
}

/** Groups paragraphs under the headings found; a text without headings is one chapter. */
export function detectChapters(paragraphs: string[], fallbackTitle: string): Chapter[] {
  const chapters: Chapter[] = [];
  for (const paragraph of paragraphs) {
    if (isHeading(paragraph)) {
      chapters.push({ title: paragraph.replace(/^#+\s*/, '').trim(), paragraphs: [] });
    } else if (chapters.length === 0) {
      chapters.push({ title: fallbackTitle, paragraphs: [paragraph] });
    } else {
      chapters.at(-1)?.paragraphs.push(paragraph);
    }
  }
  return chapters.filter((c) => c.paragraphs.length > 0);
}

/** Splits text that is too long at sentence ends, then at commas, then at spaces. */
function splitLong(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const pieces = text.match(/[^.!?…]+(?:[.!?…]+["»”)]*\s*|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const out: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (piece.length > max) {
      if (current) out.push(current);
      current = '';
      // Last resort for a giant sentence: cut at the last comma or space before the limit.
      let rest = piece;
      while (rest.length > max) {
        const window = rest.slice(0, max);
        const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf(' '));
        const at = cut > max / 2 ? cut + 1 : max;
        out.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest;
    } else if (!current) {
      current = piece;
    } else if (current.length + 1 + piece.length <= max) {
      current = `${current} ${piece}`;
    } else {
      out.push(current);
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
}

function sentence(text: string): string {
  return SENTENCE_END.test(text) ? text : `${text}.`;
}

/**
 * Cuts each chapter into segments of about `target` characters (never more than `max`), joining
 * whole paragraphs. With `readTitles`, a chapter's first segment starts with its title and a pause.
 */
export function planSegments(chapters: Chapter[], readTitles: boolean, target = SEGMENT_TARGET_CHARS, max = SEGMENT_MAX_CHARS): PlannedSegment[] {
  const segments: PlannedSegment[] = [];
  chapters.forEach((chapter, chapterIndex) => {
    const blocks = chapter.paragraphs.flatMap((p) => splitLong(p, max));
    if (readTitles) blocks.unshift(`${sentence(chapter.title)} <long pause>`);
    let current = '';
    for (const block of blocks) {
      if (!current) {
        current = block;
      } else if (current.length + 2 + block.length <= target || (current.length < target / 3 && current.length + 2 + block.length <= max)) {
        current = `${current}\n\n${block}`;
      } else {
        segments.push({ chapterIndex, text: current });
        current = block;
      }
    }
    if (current) segments.push({ chapterIndex, text: current });
  });
  return segments;
}

export interface BookPlan {
  chapters: Chapter[];
  segments: PlannedSegment[];
  characters: number;
  words: number;
  pages: number;
  estimatedSeconds: number;
}

export function planBook(raw: string, fallbackTitle: string, readTitles: boolean): BookPlan {
  const paragraphs = toParagraphs(raw);
  const chapters = detectChapters(paragraphs, fallbackTitle);
  const segments = planSegments(chapters, readTitles);
  const characters = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const words = paragraphs.reduce((sum, p) => sum + p.split(/\s+/).filter(Boolean).length, 0);
  return {
    chapters,
    segments,
    characters,
    words,
    pages: Math.max(1, Math.round(characters / CHARS_PER_PAGE)),
    estimatedSeconds: characters / 14,
  };
}
