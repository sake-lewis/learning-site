import { describe, expect, it } from 'vitest';
import { UPLOAD_LIMITS } from '../../shared/consent.ts';
import { uploadProblem } from './capture.ts';

describe('uploadProblem', () => {
  it('accepts a file within 20 MB and 3 minutes', () => {
    expect(uploadProblem(UPLOAD_LIMITS.maxBytes, UPLOAD_LIMITS.maxSec)).toBeNull();
    expect(uploadProblem(1024, 12.5)).toBeNull();
  });

  it('rejects a file over 20 MB before looking at its duration', () => {
    expect(uploadProblem(UPLOAD_LIMITS.maxBytes + 1, 10)).toBe('tooBig');
    expect(uploadProblem(UPLOAD_LIMITS.maxBytes + 1, Number.NaN)).toBe('tooBig');
  });

  it('rejects a file over 3 minutes', () => {
    expect(uploadProblem(1024, UPLOAD_LIMITS.maxSec + 1)).toBe('tooLong');
  });

  it('lets decoding decide when the browser cannot read the duration', () => {
    expect(uploadProblem(1024, Number.NaN)).toBeNull();
    expect(uploadProblem(1024, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
