// TODO: Write specs on args
//
// args_get(argv: Pointer<Pointer<u8>>, argv_buf: Pointer<u8>) -> Result<(), errno>
// Read command-line argument data. The size of the array should match that returned by args_sizes_get. Each argument is expected to be \0 terminated.
// Params
//     argv: Pointer<Pointer<u8>>
//     argv_buf: Pointer<u8>
// Results
//     error: Result<(), errno>
// Variant Layout
//     size: 8
//     align: 4
//     tag_size: 4
// Variant cases
//     ok
//     err: errno

// TODO: add tests using playwright to automate loading of the wasm binary and running it

import { test, expect } from "@playwright/test";

test("single-arg-is-hello gives non-zero exit code when run with no args", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");

  await page
    .locator("select")
    .selectOption("/programs/single-arg-is-hello.wasi.wasm");
  await page.locator("text=Run").click();

  await expect(page.locator("#exit-code")).not.toBeEmpty();
  await expect(page.locator("#exit-code")).not.toHaveText("0");
});

test("single-arg-is-hello gives 0 exit code when run with hello as arg", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");

  await page
    .locator("select")
    .selectOption("/programs/single-arg-is-hello.wasi.wasm");
  await page.locator("input#args").fill("hello");
  await page.locator("text=Run").click();

  await expect(page.locator("#exit-code")).toHaveText("0");
});
