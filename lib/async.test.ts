import { describe, expect, it } from "vitest";

import { withTimeoutFallback } from "./async";

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
