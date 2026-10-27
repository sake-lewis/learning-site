// In-memory per-minute call guard (spec S2, S8): stops a runaway loop, never a normal workload.

export class RateLimiter {
  private minute: number[] = [];
  private readonly perMinute: number;

  constructor(perMinute: number) {
    this.perMinute = perMinute;
  }

  /** Returns true when the call is allowed (and counts it). */
  take(now: number = Date.now()): boolean {
    this.minute = this.minute.filter((at) => now - at < 60_000);
    if (this.minute.length >= this.perMinute) return false;
    this.minute.push(now);
    return true;
  }
}
