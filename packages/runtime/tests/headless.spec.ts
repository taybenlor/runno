import { test, expect } from "@playwright/test";
import { RunResult } from "../lib/types";
import { TestRunResult } from "../src/main";

// TODO: These are dependent on `@runno/website` being run on localhost:4321
// See: https://github.com/taybenlor/runno/issues/258

test("a simple python example", async ({ page }) => {
  await page.goto("/");

  const result: RunResult = await page.evaluate(async () => {
    return globalThis.test.headlessRunCode("python", `print("Hello, World!")`);
  });

  expect(result.resultType).toBe("complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("Hello, World!\n");
});

test("a simple ruby example", async ({ page }) => {
  await page.goto("/");

  const result: RunResult = await page.evaluate(async () => {
    return globalThis.test.headlessRunCode("ruby", `puts "Hello, World!"`);
  });

  expect(result.resultType).toBe("complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("Hello, World!\n");
});

test("a simple js example", async ({ page }) => {
  await page.goto("/");

  const result: RunResult = await page.evaluate(async () => {
    return globalThis.test.headlessRunCode(
      "quickjs",
      `console.log("Hello, World!");`
    );
  });

  expect(result.resultType).toBe("complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("Hello, World!\n");
});

test("a simple php example", async ({ page }) => {
  await page.goto("/");

  const result: RunResult = await page.evaluate(async () => {
    return globalThis.test.headlessRunCode(
      "php-cgi",
      `
<?php
print "Hello, World!\n";
?>
`
    );
  });

  expect(result.resultType).toBe("complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Hello, World!\n");
});

test("a simple C example", async ({ page }) => {
  await page.goto("/");

  const result: TestRunResult = await page.evaluate(async () => {
    return globalThis.test.headlessRunCode(
      "clang",
      `#include <stdio.h>
#include <string.h>
int main() {
  printf("Hello, World!\\n");
}`
    );
  });

  expect(result.resultType).toBe("complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("Hello, World!\n");
});

test("a simple C++ example", async ({ page }) => {
  await page.goto("/");

  const result: TestRunResult = await page.evaluate(async () => {
    return globalThis.test.headlessRunCode(
      "clangpp",
      `
#include <iostream>
int main() {
  std::cout << "Hello, World!" << std::endl;
  return 0;
}
`
    );
  });

  expect(result.resultType).toBe("complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  expect(result.stderr).toBe("");
  expect(result.stdout).toBe("Hello, World!\n");
});
