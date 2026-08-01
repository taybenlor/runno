import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

declare global {
  interface Window {
    componentReady: boolean;
    runComponentExport: (
      path: string,
      exportName: string,
      args?: unknown[],
      imports?: Record<string, unknown>,
    ) => Promise<unknown>;
  }
}

async function ready(page: Page) {
  await page.goto("http://localhost:5174/");
  await page.waitForFunction(() => window.componentReady === true);
}

test.describe("@runno/component in the browser", () => {
  test("instantiates and calls a simple component (add)", async ({ page }) => {
    await ready(page);
    const result = await page.evaluate(() =>
      window.runComponentExport("/tests/fixtures/add.wasm", "add", [7, 35]),
    );
    expect(result).toBe(42);
  });

  test("round-trips strings through realloc (greet)", async ({ page }) => {
    await ready(page);
    const result = await page.evaluate(() =>
      window.runComponentExport("/tests/fixtures/greet.wasm", "greet", [
        "Browser 🌐",
      ]),
    );
    expect(result).toBe("Hello, Browser 🌐");
  });

  test("lowers host imports (quad)", async ({ page }) => {
    await ready(page);
    const result = await page.evaluate(async () => {
      return window.runComponentExport(
        "/tests/fixtures/quad.wasm",
        "quad",
        [5],
        { double: (x: number) => x * 2 },
      );
    });
    expect(result).toBe(20);
  });
});

test.describe("canonical ABI echo suite", () => {
  test("all value types round-trip in the browser", async ({ page }) => {
    await ready(page);
    const failures = await page.evaluate(async () => {
      const { runAllEchoCases } = await import("/tests/echo/cases.ts");
      const manifest: string[] = await (
        await fetch("/tests/fixtures/echo/manifest.json")
      ).json();
      return runAllEchoCases(manifest, async (name: string) => {
        const response = await fetch(`/tests/fixtures/echo/${name}.wasm`);
        return new Uint8Array(await response.arrayBuffer());
      });
    });
    expect(failures).toEqual([]);
  });
});

test.describe("wasmtime wast conformance", () => {
  test("expected-clean suites pass in the browser", async ({ page }) => {
    test.setTimeout(120000);
    await ready(page);
    const failures = await page.evaluate(async () => {
      const { EXPECTED_CLEAN, runWastSuite } = await import(
        "/tests/external/wast-harness.ts"
      );
      const manifest: { name: string; json: string }[] = await (
        await fetch("/tests/fixtures/external/manifest.json")
      ).json();
      const simpleModule = new Uint8Array(
        await (
          await fetch("/tests/fixtures/external/simple-module.wasm")
        ).arrayBuffer(),
      );
      const allFailures: string[] = [];
      for (const entry of manifest) {
        if (!EXPECTED_CLEAN.includes(entry.name)) continue;
        const { commands } = await (
          await fetch(`/tests/fixtures/external/${entry.json}`)
        ).json();
        const report = await runWastSuite(
          entry.name,
          commands,
          async (file: string) =>
            new Uint8Array(
              await (
                await fetch(`/tests/fixtures/external/${entry.name}/${file}`)
              ).arrayBuffer(),
            ),
          simpleModule,
        );
        allFailures.push(...report.failures);
      }
      return allFailures;
    });
    expect(failures).toEqual([]);
  });
});

test.describe("WASI 0.2", () => {
  test("runs a Rust wasm32-wasip2 component with preview2-shim", async ({
    page,
  }) => {
    await ready(page);
    const output = await page.evaluate(async () => {
      const { runHelloWasi } = await import("/tests/wasi/browser-run.ts");
      const bytes = new Uint8Array(
        await (await fetch("/tests/fixtures/wasi/hello.wasm")).arrayBuffer(),
      );
      return runHelloWasi(bytes);
    });
    expect(output).toContain("Hello from WASI 0.2!");
    expect(output).toContain("args: one,two");
    expect(output).toContain("env: it-works");
  });
});
