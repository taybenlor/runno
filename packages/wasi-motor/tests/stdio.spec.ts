// TODO: Might be worth changing this around so that it directly uses the API.
//       There's some cool stuff around fixtures that Playwright provides:
//              https://playwright.dev/docs/test-fixtures

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

test.describe("hello-world", () => {
  test.beforeEach(async ({ page }) => {
    await page
      .locator("select")
      .selectOption("/bin/tests/hello-world.wasi.wasm");
  });

  test("displays hello world and gives zero exit code", async ({ page }) => {
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).toHaveText("0");
    await expect(page.locator("#stdout")).toHaveText("Hello, World!");
  });
});

test.describe("hello-world-stderr", () => {
  test.beforeEach(async ({ page }) => {
    await page
      .locator("select")
      .selectOption("/bin/tests/hello-world-stderr.wasi.wasm");
  });

  test("displays hello world and gives zero exit code", async ({ page }) => {
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).toHaveText("0");
    await expect(page.locator("#stderr")).toHaveText("Hello, World!");
  });
});
