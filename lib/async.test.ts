import { describe, expect, it } from "vitest";

import { mapWithConcurrency, withTimeoutFallback } from "./async";

describe("withTimeoutFallback", () => {
  it("returns the task value when it resolves before the timeout", async () => {
    await expect(
      withTimeoutFallback(Promise.resolve("done"), "fallback", 50),
    ).resolves.toBe("done");
  });

  it("returns the fallback when the task is too slow", async () => {
    const slowTask = new Promise<string>((resolve) => {
      setTimeout(() => resolve("too late"), 50);
    });

    await expect(withTimeoutFallback(slowTask, "fallback", 1)).resolves.toBe(
      "fallback",
    );
  });
});

describe("mapWithConcurrency", () => {
  it("limits active tasks while preserving result order", async () => {
    let activeTasks = 0;
    let maxActiveTasks = 0;

    const results = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      2,
      async (value) => {
        activeTasks++;
        maxActiveTasks = Math.max(maxActiveTasks, activeTasks);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeTasks--;
        return value * 2;
      },
    );

    expect(maxActiveTasks).toBeLessThanOrEqual(2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });
});
