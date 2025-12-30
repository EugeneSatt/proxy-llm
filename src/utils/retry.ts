export interface RetryOptions {
  retries: number;
  minDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const computeDelay = (minDelayMs: number, maxDelayMs: number) => {
  if (maxDelayMs <= minDelayMs) return minDelayMs;
  const jitter = Math.random() * (maxDelayMs - minDelayMs);
  return Math.round(minDelayMs + jitter);
};

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = options.retries + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const allowRetry =
        attempt <= options.retries && (options.shouldRetry ? options.shouldRetry(error, attempt) : true);
      if (!allowRetry) {
        throw error;
      }

      const delay = computeDelay(options.minDelayMs, options.maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}
