import { test, expect } from "@playwright/test";
import { generateEmbedURL } from "@runno/host";
import type { TerminalElement } from "@runno/runtime";

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

  test("should say hello world", async ({ page }) => {
    await page.locator("button", { hasText: "Run" }).click();

    await page.locator("runno-controls:not([running])").waitFor();

    const terminal = await page.locator("runno-terminal").elementHandle();
    expect(terminal).not.toBeNull();
    const text = await terminal!.evaluate((terminal: TerminalElement) => {
      terminal.wasmTerminal.xterm.selectAll();
      return terminal.wasmTerminal.xterm.getSelection().trim();
    });

    expect(text).toEqual("hello world");
  });
});
