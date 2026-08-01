import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { instantiateComponent } from "../../lib/main.ts";

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function load(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(fixture(name)));
}

test("instantiates the add component and calls its export", async () => {
  const { exports } = await instantiateComponent(await load("add.wasm"));
  const add = exports.add as (a: number, b: number) => number;
  assert.equal(add(1, 2), 3);
  assert.equal(add(1000000, 2000000), 3000000);
});

test("lifts and lowers strings with realloc (greet)", async () => {
  const { exports } = await instantiateComponent(await load("greet.wasm"));
  const greet = exports.greet as (name: string) => string;
  assert.equal(greet("Runno"), "Hello, Runno");
  assert.equal(greet(""), "Hello, ");
  assert.equal(greet("héllø 🌍"), "Hello, héllø 🌍");
});

test("lowers host function imports (quad)", async () => {
  const calls: number[] = [];
  const { exports } = await instantiateComponent(await load("quad.wasm"), {
    double: (x: number) => {
      calls.push(x);
      return x * 2;
    },
  });
  const quad = exports.quad as (x: number) => number;
  assert.equal(quad(5), 20);
  assert.deepEqual(calls, [5, 10]);
});
