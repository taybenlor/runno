import { test, expect } from "@playwright/test";
import type { TerminalElement } from "@runno/runtime";
import { encode } from "url-safe-base64";

function generateEmbedURL(
  code: string,
  runtime: string,
  options?: {
    showControls?: boolean; // Default: true
    showEditor?: boolean; // Default: true
    autorun?: boolean; // Default: false
    baseUrl?: string; // Default: "https://runno.run/"
  }
): URL {
  const showEditor =
    options?.showEditor === undefined ? true : options?.showEditor;
  const showControls =
    options?.showControls === undefined ? true : options?.showControls;
  const autorun = options?.autorun || false;
  const baseUrl = options?.baseUrl || "https://runno.run/";
  const url = new URL(baseUrl);
  if (showEditor) {
    url.searchParams.append("editor", "1");
  }
  if (autorun) {
    url.searchParams.append("autorun", "1");
  }
  if (!showControls) {
    url.searchParams.append("controls", "0");
  }
  url.searchParams.append("runtime", runtime);
  url.searchParams.append("code", encode(btoa(code)));
  return url;
}

const baseURL = "http://localhost:5678/";

test.describe("Blank Runno", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
  });

  test("should have a run button", async ({ page }) => {
    await expect(page.locator("button")).toHaveText("Run");
  });
});

test.describe("Python Hello World", () => {
  const program = `print('hello world')`;

  test.beforeEach(async ({ page }) => {
    await page.goto(
      generateEmbedURL(program, "python", {
        showControls: true,
        showEditor: true,
        baseUrl: baseURL,
      }).toString()
    );
  });

  test("should include the program", async ({ page }) => {
    await expect(page.locator("runno-editor .cm-content")).toHaveText(program);
  });

  test("should say hello world", async ({ page, browserName }) => {
    // https://github.com/microsoft/playwright/issues/14043
    test.skip(
      browserName === "webkit",
      "Playwright doesn't support SharedArrayBuffer"
    );

    await page.locator("button", { hasText: "Run" }).click();

    await page.locator("runno-controls:not([running])").waitFor();

    const terminal = await page.locator("runno-terminal").elementHandle();
    expect(terminal).not.toBeNull();
    const text = await terminal!.evaluate((terminal: TerminalElement) => {
      terminal.terminal.selectAll();
      return terminal.terminal.getSelection().trim();
    });

    expect(text).toEqual("hello world");
  });
});
