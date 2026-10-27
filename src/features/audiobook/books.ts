// Audiobook storage helpers: create from a plan, delete, and assemble chapter or book audio.
import type { TtsModel } from '../../../shared/models.ts';
import { db, type Book, type BookSegment } from '../../db/schema.ts';
import { assembleWav, type Assembled } from './assemble.ts';
import { planBook } from './chunker.ts';
import { isRunning, pauseRunner } from './runner.ts';

export const SEGMENT_GAP_MS = 600;
export const CHAPTER_GAP_MS = 2000;
export const MAX_BOOK_CHARS = 450_000; // about 250 pages

export interface NewBook {
  title: string;
  text: string;
  voiceId: string;
  voiceName: string;
  style: string;
  model: TtsModel;
  readTitles: boolean;
}

export async function createBook(input: NewBook): Promise<string> {
  const plan = planBook(input.text, input.title, input.readTitles);
  if (plan.segments.length === 0) throw new Error('EMPTY');
  const id = crypto.randomUUID();
  const now = Date.now();
  const book: Book = {
    id,
    title: input.title,
    voiceId: input.voiceId,
    voiceName: input.voiceName,
    style: input.style,
    model: input.model,
    readTitles: input.readTitles,
    chapters: plan.chapters.map((c, i) => ({ title: c.title, segmentCount: plan.segments.filter((s) => s.chapterIndex === i).length })),
    characters: plan.characters,
    status: 'ready',
    pause: null,
    createdAt: now,
    updatedAt: now,
  };
  const segments: BookSegment[] = plan.segments.map((s, index) => ({
    id: crypto.randomUUID(),
    bookId: id,
    chapterIndex: s.chapterIndex,
    index,
    text: s.text,
    status: 'pending',
    wav: null,
    seconds: 0,
    attempts: 0,
    error: null,
  }));
  await db.transaction('rw', db.books, db.bookSegments, async () => {
    await db.books.add(book);
    await db.bookSegments.bulkAdd(segments);
  });
  return id;
}

export async function deleteBook(id: string): Promise<void> {
  if (isRunning(id)) pauseRunner();
  await db.transaction('rw', db.books, db.bookSegments, async () => {
    await db.bookSegments.where('bookId').equals(id).delete();
    await db.books.delete(id);
  });
}

export async function bookSegments(bookId: string): Promise<BookSegment[]> {
  return db.bookSegments.where('bookId').equals(bookId).sortBy('index');
}

function wavsOf(segments: BookSegment[]): Blob[] {
  return segments.map((s) => s.wav).filter((w): w is Blob => w !== null);
}

/** Audio of one chapter; every segment of the chapter must be generated. */
export async function chapterAudio(bookId: string, chapterIndex: number): Promise<Assembled> {
  const segments = (await bookSegments(bookId)).filter((s) => s.chapterIndex === chapterIndex);
  if (segments.some((s) => s.status !== 'done' || !s.wav)) throw new Error('INCOMPLETE');
  return assembleWav([wavsOf(segments)], SEGMENT_GAP_MS, 0);
}

/** Audio of the whole book, chapters separated by a longer silence. */
export async function fullBookAudio(bookId: string): Promise<Assembled> {
  const segments = await bookSegments(bookId);
  if (segments.some((s) => s.status !== 'done' || !s.wav)) throw new Error('INCOMPLETE');
  const chapters = new Map<number, BookSegment[]>();
  for (const s of segments) chapters.set(s.chapterIndex, [...(chapters.get(s.chapterIndex) ?? []), s]);
  return assembleWav([...chapters.values()].map(wavsOf), SEGMENT_GAP_MS, CHAPTER_GAP_MS);
}

/** Marks one segment for generation again (e.g. a mispronunciation heard on listening). */
export async function resetSegment(segmentId: string): Promise<void> {
  const segment = await db.bookSegments.get(segmentId);
  if (!segment) return;
  await db.bookSegments.update(segmentId, { status: 'pending', wav: null, seconds: 0, attempts: 0, error: null });
  // A running queue picks the segment up by itself; otherwise the book waits for Resume.
  if (!isRunning(segment.bookId)) {
    await db.books.update(segment.bookId, { status: 'paused', pause: { reason: 'user', code: 'USER', detail: null, resumeAfter: null }, updatedAt: Date.now() });
  }
}
