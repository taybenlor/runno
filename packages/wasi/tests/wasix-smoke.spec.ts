import { test, expect } from "@playwright/test";

import type { WASIX, WASIXContext } from "../lib/main";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.waitForLoadState("domcontentloaded");
});

test("WASIX runs a WASI preview1 hello-world: exits 0, prints to stdout", async ({
  page,
}) => {
  const result = await page.evaluate(async function () {
    while (window["WASIX"] === undefined) {
      await new Promise((resolve) => setTimeout(resolve));
    }

    const W: typeof WASIX = (window as any)["WASIX"];
    const WC: typeof WASIXContext = (window as any)["WASIXContext"];

    let stdout = "";

    const wasiResult = await W.start(
      fetch("/bin/tests/hello-world.wasi.wasm"),
      new WC({
        args: [],
        stdout: (out: string) => {
          stdout += out;
        },
        stderr: () => {},
        stdin: () => null,
        fs: {},
      }),
    );

    return { exitCode: wasiResult.exitCode, stdout };
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("Hello, World!\n");
});
