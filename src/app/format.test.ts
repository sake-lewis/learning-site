import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration } from './format.ts';

describe('formatDuration', () => {
  it('shows seconds under a minute', () => {
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(-5)).toBe('0 s');
    expect(formatDuration(59)).toBe('59 s');
  });

  it('shows minutes and seconds under an hour', () => {
    expect(formatDuration(59.6)).toBe('1 min 00 s');
    expect(formatDuration(125)).toBe('2 min 05 s');
    expect(formatDuration(3599)).toBe('59 min 59 s');
  });

  it('shows hours and minutes from an hour on', () => {
    expect(formatDuration(3600)).toBe('1 h 00 min');
    expect(formatDuration(5400)).toBe('1 h 30 min');
    expect(formatDuration(7140)).toBe('1 h 59 min');
  });

  it('carries a rounded-up minute into the hour', () => {
    expect(formatDuration(7170)).toBe('2 h 00 min');
    expect(formatDuration(3599.6)).toBe('1 h 00 min');
    expect(formatDuration(10_770)).toBe('3 h 00 min');
  });
});

describe('formatClock', () => {
  it('shows minutes and seconds, truncated', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(3725)).toBe('62:05');
  });
});
