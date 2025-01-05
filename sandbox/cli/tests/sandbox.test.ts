import { assertEquals, assertMatch } from "@std/assert";

import { runCode } from "../lib/main.ts";

Deno.test("a simple python example", async () => {
  const result = await runCode("python", `print("Hello, World!")`);
  assertEquals(result.resultType, "complete", JSON.stringify(result));
  if (result.resultType !== "complete") throw new Error("wtf");
  assertEquals(result.stderr, "");
  assertEquals(result.stdout, "Hello, World!\n");
});

Deno.test("a simple ruby example", async () => {
  const result = await runCode("ruby", `puts "Hello, World!"`);

  assertEquals(result.resultType, "complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  assertEquals(result.stderr, "");
  assertEquals(result.stdout, "Hello, World!\n");
});

Deno.test("a simple js example", async () => {
  const result = await runCode("quickjs", `console.log("Hello, World!");`);

  assertEquals(result.resultType, "complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  assertEquals(result.stderr, "");
  assertEquals(result.stdout, "Hello, World!\n");
});

Deno.test("a simple php example", async () => {
  const result = await runCode(
    "php-cgi",
    `
<?php
print "Hello, World!\n";
?>
`
  );

  assertEquals(result.resultType, "complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  assertEquals(result.stderr, "");
  assertMatch(result.stdout, /Hello, World!\n/);
});

Deno.test("a simple C example", async () => {
  const result = await runCode(
    "clang",
    `#include <stdio.h>
#include <string.h>
int main() {
  printf("Hello, World!\\n");
}`
  );

  assertEquals(result.resultType, "complete", JSON.stringify(result));
  if (result.resultType !== "complete") throw new Error("wtf");
  assertEquals(result.stderr, "");
  assertEquals(result.stdout, "Hello, World!\n");
});

Deno.test("a simple C++ example", async () => {
  const result = await runCode(
    "clangpp",
    `
#include <iostream>
int main() {
  std::cout << "Hello, World!" << std::endl;
  return 0;
}
`
  );

  assertEquals(result.resultType, "complete");
  if (result.resultType !== "complete") throw new Error("wtf");
  assertEquals(result.stderr, "");
  assertEquals(result.stdout, "Hello, World!\n");
});

Deno.test("a simple timeout example", async () => {
  const result = await runCode("python", `while True:pass`, { timeout: 0.5 });
  assertEquals(result.resultType, "timeout");
});
