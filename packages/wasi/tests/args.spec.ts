// TODO: Might be worth changing this around so that it directly uses the API.
//       There's some cool stuff around fixtures that Playwright provides:
//              https://playwright.dev/docs/test-fixtures

import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
});

test.describe("return-arg-count", () => {
  test.beforeEach(async ({ page }) => {
    await page
      .locator("select")
      .selectOption("/bin/tests/return-arg-count.wasi.wasm");
  });

  test("gives zero exit code when run with no args", async ({ page }) => {
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).toHaveText("0");
  });

  test("gives 1 exit code when run with 1 arg", async ({ page }) => {
    await page.locator("input#args").fill("hello");
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).toHaveText("1");
  });

  test("gives 2 exit code when run with 2 args", async ({ page }) => {
    await page.locator("input#args").fill("hello gday");
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).toHaveText("2");
  });

  test("gives 100 exit code when run with 100 args", async ({ page }) => {
    await page.locator("input#args").fill("banana ".repeat(100).trim());
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).toHaveText("100");
  });
});

test.describe("single-arg-is-hello", () => {
  test.beforeEach(async ({ page }) => {
    await page
      .locator("select")
      .selectOption("/bin/tests/single-arg-is-hello.wasi.wasm");
  });

  test("gives non-zero exit code when run with no args", async ({ page }) => {
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).not.toBeEmpty();
    await expect(page.locator("#exit-code")).not.toHaveText("0");
  });

  test("gives 0 exit code when run with hello as arg", async ({ page }) => {
    await page.locator("input#args").fill("hello");
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).toHaveText("0");
  });
});

test.describe("three-args-foo-bar-baz", () => {
  test.beforeEach(async ({ page }) => {
    await page
      .locator("select")
      .selectOption("/bin/tests/three-args-foo-bar-baz.wasi.wasm");
  });

  test("gives non-zero exit code when run with no args", async ({ page }) => {
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).not.toBeEmpty();
    await expect(page.locator("#exit-code")).not.toHaveText("0");
  });

  test("gives non-zero exit code when run with hello as arg", async ({
    page,
  }) => {
    await page.locator("input#args").fill("hello");
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).not.toBeEmpty();
    await expect(page.locator("#exit-code")).not.toHaveText("0");
  });

  test("gives zero exit code when run with foo bar baz as args", async ({
    page,
  }) => {
    await page.locator("input#args").fill("foo bar baz");
    await page.locator("text=Run").click();

    await expect(page.locator("#exit-code")).toHaveText("0");
  });
});
