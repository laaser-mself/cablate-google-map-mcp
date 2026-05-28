export class ConcurrencyLimiter {
  private running = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }
}

function parseMaxConcurrent(): number {
  const raw = process.env.GOOGLE_MAPS_MAX_CONCURRENT;
  if (!raw) {
    return 50;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

let limiter: ConcurrencyLimiter | null = null;

export function getGoogleMapsLimiter(): ConcurrencyLimiter {
  if (!limiter) {
    limiter = new ConcurrencyLimiter(parseMaxConcurrent());
  }
  return limiter;
}
