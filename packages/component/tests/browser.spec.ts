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
