export async function withTimeoutFallback<T>(
  task: Promise<T>,
  fallback: T,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1.");
  }

  const results = new Array<PromiseSettledResult<R> | undefined>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex++;
      try {
        results[currentIndex] = { status: "fulfilled", value: await mapper(items[currentIndex], currentIndex) };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results as PromiseSettledResult<R>[];
}

export function partitionResults<T>(
  results: PromiseSettledResult<T>[],
): { fulfilled: T[]; rejected: { index: number; reason: unknown }[] } {
  const fulfilled: T[] = [];
  const rejected: { index: number; reason: unknown }[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      fulfilled.push(result.value);
    } else {
      rejected.push({ index, reason: result.reason });
    }
  });

  return { fulfilled, rejected };
}
