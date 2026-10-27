// Google resets Gemini API daily quotas at midnight Pacific time; show that moment in local time.

const PACIFIC = 'America/Los_Angeles';

function pacificWallClock(at: Date): { y: number; m: number; d: number; offsetMs: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return { y: get('year'), m: get('month'), d: get('day'), offsetMs: wall - Math.floor(at.getTime() / 1000) * 1000 };
}

/** The next midnight in the Pacific time zone, as an absolute instant. */
export function nextQuotaReset(now: Date = new Date()): Date {
  const { y, m, d, offsetMs } = pacificWallClock(now);
  const candidate = new Date(Date.UTC(y, m - 1, d + 1) - offsetMs);
  // Across a daylight-saving change the offset differs by an hour: re-anchor on the candidate's own offset.
  const check = pacificWallClock(candidate);
  return new Date(Date.UTC(y, m - 1, d + 1) - check.offsetMs);
}

export function quotaResetLabel(lang: 'fr' | 'en', now: Date = new Date()): string {
  return nextQuotaReset(now).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}
