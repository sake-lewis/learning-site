// Audiobook generation queue (spec F16): one segment at a time, persisted in IndexedDB so it resumes
// exactly where it stopped. Free-tier quota errors are waited out; a daily quota pauses the book.
import Dexie from 'dexie';
import { create } from 'zustand';
import { ApiError, synthesize } from '../../app/api.ts';
import { nextQuotaReset } from '../../app/quota.ts';
import { db, type Book } from '../../db/schema.ts';

export type RunnerPhase = 'idle' | 'generating' | 'waiting';

interface RunnerState {
  bookId: string | null;
  phase: RunnerPhase;
  segmentIndex: number | null;
  waitUntil: number | null;
  startedAt: number | null;
  doneThisRun: number;
}

const IDLE: RunnerState = { bookId: null, phase: 'idle', segmentIndex: null, waitUntil: null, startedAt: null, doneThisRun: 0 };

export const useRunner = create<RunnerState>(() => IDLE);

const QUOTA_WAIT_MS = 65_000;
const MAX_QUOTA_WAITS = 4;
const MAX_ATTEMPTS = 3;
const TRANSIENT = new Set(['TIMEOUT', 'UPSTREAM', 'NETWORK', 'NO_AUDIO']);

let controller: AbortController | null = null;

/** Google names the exhausted quota in its message; per-day quotas cannot be waited out. */
export function isDailyQuota(detail: string | null | undefined): boolean {
  return /per.?day|daily/i.test(detail ?? '');
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, Math.max(0, ms));
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function pauseBook(bookId: string, pause: NonNullable<Book['pause']>): Promise<void> {
  await db.books.update(bookId, { status: 'paused', pause, updatedAt: Date.now() });
}

function nextPending(bookId: string) {
  return db.bookSegments
    .where('[bookId+index]')
    .between([bookId, Dexie.minKey], [bookId, Dexie.maxKey])
    .filter((s) => s.status !== 'done')
    .first();
}

export function isRunning(bookId?: string): boolean {
  return controller !== null && (bookId === undefined || useRunner.getState().bookId === bookId);
}

/** How a start request ended: the queue ran, this tab was already running one, or another tab is. */
export type StartResult = 'ran' | 'busy-here' | 'other-tab';

/**
 * Generates every unfinished segment of a book, in order. One book runs at a time: the in-tab lock
 * is taken before any await, and a Web Lock stops a second browser tab from running the same queue.
 */
export async function startBook(bookId: string): Promise<StartResult> {
  if (controller) return 'busy-here';
  const mine = new AbortController();
  controller = mine;
  const runHere = async (): Promise<StartResult> => {
    // Shown as running only once the lock is held, so a refused start never flashes "generating".
    useRunner.setState({ ...IDLE, bookId, phase: 'generating', startedAt: Date.now() });
    await run(bookId, mine.signal);
    return 'ran';
  };
  try {
    if (!navigator.locks) return await runHere();
    return await navigator.locks.request('timbre-audiobook-runner', { ifAvailable: true }, async (lock): Promise<StartResult> => (lock ? runHere() : 'other-tab'));
  } finally {
    if (controller === mine) {
      controller = null;
      useRunner.setState(IDLE);
    }
  }
}

async function run(bookId: string, signal: AbortSignal): Promise<void> {
  if (!(await db.books.get(bookId))) return;
  // Ask the browser not to evict hundreds of MB of audio under storage pressure.
  void navigator.storage?.persist?.().catch(() => false);
  await db.bookSegments.where('bookId').equals(bookId).filter((s) => s.status === 'failed').modify({ status: 'pending', attempts: 0 });
  await db.books.update(bookId, { status: 'running', pause: null, updatedAt: Date.now() });

  let quotaWaits = 0;
  while (!signal.aborted) {
    const current = await db.books.get(bookId);
    if (!current) return; // deleted while running
    const next = await nextPending(bookId);
    if (!next) {
      await db.books.update(bookId, { status: 'done', pause: null, updatedAt: Date.now() });
      return;
    }
    useRunner.setState({ phase: 'generating', segmentIndex: next.index, waitUntil: null });

    try {
      const result = await synthesize({ text: next.text, style: current.style, voice: current.voiceId, model: current.model }, signal);
      await db.bookSegments.update(next.id, { status: 'done', wav: result.blob, seconds: result.seconds, error: null });
      quotaWaits = 0;
      useRunner.setState((s) => ({ doneThisRun: s.doneThisRun + 1 }));
    } catch (error) {
      if (signal.aborted || (error instanceof ApiError && error.code === 'CANCELLED')) break;
      // Dexie wraps storage errors in its own class but keeps the DOM error name.
      const name = (error as { name?: string; inner?: { name?: string } } | null)?.name;
      const innerName = (error as { inner?: { name?: string } } | null)?.inner?.name;
      if (name === 'QuotaExceededError' || innerName === 'QuotaExceededError') {
        await pauseBook(bookId, { reason: 'error', code: 'STORAGE_FULL', detail: null, resumeAfter: null });
        return;
      }
      const code = error instanceof ApiError ? error.code : 'generic';
      const detail = error instanceof ApiError ? (error.detail ?? null) : String(error);

      if (code === 'QUOTA' || code === 'RATE_MINUTE') {
        quotaWaits++;
        const scope = error instanceof ApiError ? error.scope : undefined;
        const daily = scope === 'day' || (scope !== 'minute' && isDailyQuota(detail));
        if ((code === 'QUOTA' && daily) || quotaWaits > MAX_QUOTA_WAITS) {
          await pauseBook(bookId, { reason: 'quota', code, detail, resumeAfter: nextQuotaReset().getTime() });
          return;
        }
        // Google's own retry delay when it gives one, otherwise a growing wait.
        const suggested = error instanceof ApiError && error.retryAfterSec ? (error.retryAfterSec + 5) * 1000 : 0;
        const until = Date.now() + Math.max(suggested, QUOTA_WAIT_MS * quotaWaits);
        useRunner.setState({ phase: 'waiting', waitUntil: until });
        await sleep(until - Date.now(), signal);
        continue;
      }

      if (TRANSIENT.has(code)) {
        const attempts = next.attempts + 1;
        const failed = attempts >= MAX_ATTEMPTS;
        await db.bookSegments.update(next.id, { attempts, error: code, ...(failed ? { status: 'failed' as const } : {}) });
        if (failed) {
          await pauseBook(bookId, { reason: 'error', code, detail, resumeAfter: null });
          return;
        }
        const until = Date.now() + 10_000 * attempts;
        useRunner.setState({ phase: 'waiting', waitUntil: until });
        await sleep(until - Date.now(), signal);
        continue;
      }

      // Key, permission, model or input problems will not fix themselves: stop and explain.
      await pauseBook(bookId, { reason: 'error', code, detail, resumeAfter: null });
      return;
    }
  }
  if (signal.aborted && (await db.books.get(bookId))) {
    await pauseBook(bookId, { reason: 'user', code: 'USER', detail: null, resumeAfter: null });
  }
}

export function pauseRunner(): void {
  controller?.abort();
}
