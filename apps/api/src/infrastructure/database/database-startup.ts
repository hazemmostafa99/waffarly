import { setTimeout } from 'node:timers/promises';

/** Retry only the startup probe; business operations must never be replayed here. */
export async function waitForDatabase(
  probe: () => Promise<unknown>,
  options: { attempts: number; retryDelayMs: number },
  onRetry: (attempt: number, delayMs: number) => void,
  sleep: (delayMs: number) => Promise<unknown> = setTimeout,
): Promise<void> {
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      await probe();
      return;
    } catch {
      if (attempt === options.attempts) break;
      const delayMs = Math.min(options.retryDelayMs * 2 ** (attempt - 1), 5_000);
      onRetry(attempt, delayMs);
      await sleep(delayMs);
    }
  }
  throw new Error(`Database startup check failed after ${options.attempts} attempts.`);
}
