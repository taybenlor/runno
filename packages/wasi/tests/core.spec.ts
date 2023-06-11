import * as fs from "fs";

import { test, expect } from "@playwright/test";

import type { WASI, WASIContext } from "../lib/main";
import { getStatus } from "./helpers.ts";

const files = fs.readdirSync("public/bin/wasi-test-suite-main/core");
const wasmFiles = files.filter((f) => f.endsWith(".wasm"));

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.waitForLoadState("domcontentloaded");
});

for (const name of wasmFiles) {
  const expectedStatus = getStatus("core", name);

  test.describe(`core/${name}`, () => {
    test(`Gives a ${expectedStatus} exit code`, async ({ page }) => {
      const result = await page.evaluate(async function (url) {
        while (window["WASI"] === undefined) {
          await new Promise((resolve) => setTimeout(resolve));
        }

        const W: typeof WASI = (window as any)["WASI"];
        const WC: typeof WASIContext = (window as any)["WASIContext"];

        return W.start(
          fetch(url),
          new WC({
            args: [],
            stdout: () => {},
            stderr: () => {},
            stdin: () => null,
            fs: {},
          })
        );
      }, `/bin/wasi-test-suite-main/core/${name}`);

      expect(result.exitCode).toBe(expectedStatus);
    });
  });
}
