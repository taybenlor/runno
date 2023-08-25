import { test, expect } from "@playwright/test";
import { RunResult } from "@runno/host";

// TODO: These are dependent on `@runno/website` being run on localhost:4321
// See: https://github.com/taybenlor/runno/issues/258

// TODO: This python test times out, I think because of the massive base tar file.
// When I comment out the base FS it works fine.
test.skip("a simple python example", async ({ page }) => {
  await page.goto("/");

  const result: RunResult = await page.evaluate(async () => {
    return await globalThis.Runno.headlessRunCode(
      "python",
      `print("Hello, World!")`
    );
  });

  expect(result.resultType).toBe("complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("Hello, World!\n");
});

test("a simple ruby example", async ({ page }) => {
  await page.goto("/");

  const result: RunResult = await page.evaluate(async () => {
    return await globalThis.Runno.headlessRunCode(
      "ruby",
      `puts "Hello, World!"`
    );
  });

  expect(result.resultType).toBe("complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("Hello, World!\n");
});
