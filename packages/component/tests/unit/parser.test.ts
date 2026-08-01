import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parseComponent, isComponent } from "../../lib/parser/parser.ts";

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

test("detects a component binary", async () => {
  const bytes = new Uint8Array(await readFile(fixture("add.wasm")));
  assert.equal(isComponent(bytes), true);
});

test("parses the add component", async () => {
  const bytes = new Uint8Array(await readFile(fixture("add.wasm")));
  const component = parseComponent(bytes);
  assert.equal(component.version, 0x0d);

  const kinds = component.definitions.map((d) => d.kind);
  assert.ok(kinds.includes("core-module"));
  assert.ok(kinds.includes("core-instance"));
  assert.ok(kinds.includes("canon"));
  assert.ok(kinds.includes("export"));

  const coreModule = component.definitions.find(
    (d) => d.kind === "core-module",
  );
  assert.ok(coreModule && coreModule.kind === "core-module");
  // The embedded core module must itself be valid wasm (magic header).
  const moduleBytes = component.bytes.subarray(
    coreModule.offset,
    coreModule.offset + coreModule.length,
  );
  assert.deepEqual(
    Array.from(moduleBytes.subarray(0, 4)),
    [0x00, 0x61, 0x73, 0x6d],
  );

  const canon = component.definitions.find((d) => d.kind === "canon");
  assert.ok(canon && canon.kind === "canon");
  assert.equal(canon.canon.kind, "lift");

  const exportDef = component.definitions.find((d) => d.kind === "export");
  assert.ok(exportDef && exportDef.kind === "export");
  assert.equal(exportDef.name.name, "add");
});
