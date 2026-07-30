// Error-model boundary tests (WASIX-PLAN.md "Error model"):
//
//   - Provider throws a `WASIXError` subclass → its `.result` is returned
//     as the syscall's errno.
//   - Provider throws anything else → syscall returns EIO; the thrown
//     value is NOT propagated across the WASM boundary (the guest sees a
//     normal errno, `WASIX.start` resolves normally).
//
// Uses the `wasix-errno.wasm` probe, which calls `random_get` and exits
// with the returned errno as the process exit code — so the exact errno
// the guest observed is visible from outside.

import { test, expect } from "@playwright/test";

import type {
  WASIX,
  WASIXContext,
  WASIDriveFileSystemProvider,
  WASIX32v1,
} from "../lib/main";

const EACCES = 2;
const EIO = 29;

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.waitForLoadState("domcontentloaded");
});

async function runErrnoProbe(
  page: import("@playwright/test").Page,
  providerKind: "ok" | "throws-wasix-error" | "throws-plain-error",
): Promise<{ exitCode: number; threw: string | null }> {
  return page.evaluate(async function (kind) {
    while ((window as any)["WASIX"] === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const W: typeof WASIX = (window as any)["WASIX"];
    const WC: typeof WASIXContext = (window as any)["WASIXContext"];
    const WD: typeof WASIDriveFileSystemProvider = (window as any)[
      "WASIDriveFileSystemProvider"
    ];
    const ABI: typeof WASIX32v1 = (window as any)["WASIX32v1"];

    const random =
      kind === "ok"
        ? undefined
        : {
            fill: () => {
              if (kind === "throws-wasix-error") {
                // Result.EACCES === 2
                throw new ABI.WASIXError(2);
              }
              throw new Error("provider exploded");
            },
          };

    let threw: string | null = null;
    let exitCode = -1;
    try {
      const result = await W.start(
        fetch("/bin/tests/wasix-errno.wasm"),
        new WC({
          args: [],
          random,
          stdout: () => {},
          stderr: () => {},
          stdin: () => null,
          fs: new WD({}),
        }),
      );
      exitCode = result.exitCode;
    } catch (e: any) {
      threw = `${e?.message ?? e}`;
    }
    return { exitCode, threw };
  }, providerKind);
}

test("healthy provider: guest sees errno 0", async ({ page }) => {
  const result = await runErrnoProbe(page, "ok");
  expect(result.threw).toBe(null);
  expect(result.exitCode).toBe(0);
});

test("provider throws WASIXError: guest sees that errno, no JS propagation", async ({
  page,
}) => {
  const result = await runErrnoProbe(page, "throws-wasix-error");
  expect(result.threw).toBe(null);
  expect(result.exitCode).toBe(EACCES);
});

test("provider throws a plain Error: guest sees EIO, no JS propagation", async ({
  page,
}) => {
  const result = await runErrnoProbe(page, "throws-plain-error");
  expect(result.threw).toBe(null);
  expect(result.exitCode).toBe(EIO);
});
