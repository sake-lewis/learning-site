// Storage retention (spec 7.4): Text to Speech takes and their history rows are deleted after
// RETENTION_DAYS, so the browser store does not grow forever. Audiobooks, voices and previews are kept.
import { db } from '../db/schema.ts';

export const RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

/** Deletes Text to Speech generations older than the retention period; returns how many history rows went. */
export async function purgeExpiredTakes(now: number = Date.now()): Promise<number> {
  const cutoff = now - RETENTION_DAYS * DAY_MS;
  return db.transaction('rw', db.takes, db.history, async () => {
    // Takes of project segments (Phase 3) follow the "chosen take" rule instead: only free takes expire here.
    const takeIds = await db.takes
      .where('createdAt')
      .below(cutoff)
      .filter((take) => take.segmentId === null)
      .primaryKeys();
    const historyIds = await db.history
      .where('createdAt')
      .below(cutoff)
      .filter((entry) => entry.projectId === null)
      .primaryKeys();
    await db.takes.bulkDelete(takeIds);
    await db.history.bulkDelete(historyIds);
    return historyIds.length;
  });
}
