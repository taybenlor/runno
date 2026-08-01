import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { runAllEchoCases } from "../echo/cases.ts";

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/echo/${name}`, import.meta.url));

test("echo fixtures round-trip all value types", async () => {
  const manifest: string[] = JSON.parse(
    await readFile(fixture("manifest.json"), "utf-8"),
  );
  assert.ok(manifest.length >= 25, "expected a full manifest");
  const failures = await runAllEchoCases(manifest, async (name) => {
    return new Uint8Array(await readFile(fixture(`${name}.wasm`)));
  });
  assert.deepEqual(failures, []);
});
