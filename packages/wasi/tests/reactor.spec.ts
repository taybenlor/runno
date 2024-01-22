import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

test.describe("reactor-return-57", () => {
  test.beforeEach(async ({ page }) => {
    await page.locator("select").selectOption("/reactors/return_57.wasi.wasm");
  });

  test("returns 57", async ({ page }) => {
    await page.locator("text=Reactor").click();

    await expect(page.locator("#exit-code")).toHaveText("57");
  });
});
