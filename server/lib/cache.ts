// Short-lived result cache (spec S8): an identical request within 10 minutes is not billed twice.
import { createHash } from 'node:crypto';

interface Entry<T> {
  value: T;
  bytes: number;
  expires: number;
}

export class ResultCache<T> {
  private entries = new Map<string, Entry<T>>();
  private totalBytes = 0;
  private readonly ttlMs: number;
  private readonly maxBytes: number;

  constructor(ttlMs: number, maxBytes: number) {
    this.ttlMs = ttlMs;
    this.maxBytes = maxBytes;
  }

  static key(parts: readonly string[]): string {
    return createHash('sha256').update(parts.join('\u0000')).digest('hex');
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= now) {
      this.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, bytes: number, now = Date.now()): void {
    if (bytes > this.maxBytes) return;
    this.delete(key);
    this.entries.set(key, { value, bytes, expires: now + this.ttlMs });
    this.totalBytes += bytes;
    // Map keeps insertion order: evict the oldest entries first.
    for (const oldest of this.entries.keys()) {
      if (this.totalBytes <= this.maxBytes) break;
      this.delete(oldest);
    }
  }

  private delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.totalBytes -= entry.bytes;
    this.entries.delete(key);
  }
}
