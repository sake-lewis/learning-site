import { describe, expect, it } from 'vitest';
import { nextQuotaReset } from './quota.ts';

describe('nextQuotaReset', () => {
  it('returns the next midnight Pacific in winter (UTC-8)', () => {
    // 2026-10-27 is still daylight time in California (PDT, UTC-7) until 2026-11-01.
    expect(nextQuotaReset(new Date('2026-10-27T12:00:00Z')).toISOString()).toBe('2026-10-28T07:00:00.000Z');
    expect(nextQuotaReset(new Date('2026-12-10T12:00:00Z')).toISOString()).toBe('2026-12-11T08:00:00.000Z');
  });

  it('uses the Pacific calendar day, not the UTC one', () => {
    // 03:00 UTC on Dec 11 is still Dec 10 in California, so the reset is Dec 11 08:00 UTC.
    expect(nextQuotaReset(new Date('2026-12-11T03:00:00Z')).toISOString()).toBe('2026-12-11T08:00:00.000Z');
  });

  it('handles the switch from daylight to standard time', () => {
    // Evening of 2026-10-31 PDT; midnight Nov 1 is still PDT (the change happens at 2 a.m.).
    expect(nextQuotaReset(new Date('2026-11-01T05:00:00Z')).toISOString()).toBe('2026-11-01T07:00:00.000Z');
    // Evening of 2026-11-01 PST; next midnight Nov 2 is PST.
    expect(nextQuotaReset(new Date('2026-11-02T05:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });
});
