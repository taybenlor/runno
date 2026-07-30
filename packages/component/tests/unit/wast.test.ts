import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_CLEAN,
  runWastSuite,
  type WastReport,
} from "../external/wast-harness.ts";

const external = (name: string) =>
  fileURLToPath(new URL(`../fixtures/external/${name}`, import.meta.url));

test("wasmtime component-model wast conformance", async (t) => {
  const manifest: { name: string; json: string }[] = JSON.parse(
    await readFile(external("manifest.json"), "utf-8"),
  );
  assert.ok(manifest.length >= 20, "external suites not prepared");

  const reports: WastReport[] = [];
  for (const entry of manifest) {
    const { commands } = JSON.parse(
      await readFile(external(entry.json), "utf-8"),
    );
    const simpleModule = new Uint8Array(
      await readFile(external("simple-module.wasm")),
    );
    const report = await runWastSuite(
      entry.name,
      commands,
      async (file) =>
        new Uint8Array(await readFile(external(`${entry.name}/${file}`))),
      simpleModule,
    );
    reports.push(report);
  }

  let totalPassed = 0;
  let totalFailed = 0;
  for (const report of reports) {
    totalPassed += report.passed;
    totalFailed += report.failed;
    const status = report.failed === 0 ? "PASS" : "FAIL";
    t.diagnostic(
      `${status} ${report.suite}: ${report.passed} passed, ` +
        `${report.failed} failed, ${report.skipped} skipped`,
    );
    for (const failure of report.failures.slice(0, 5)) {
      t.diagnostic(`  ${failure}`);
    }
  }
  t.diagnostic(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);

  for (const report of reports) {
    if (EXPECTED_CLEAN.includes(report.suite)) {
      assert.deepEqual(report.failures, [], `suite ${report.suite} must pass`);
    }
  }
});
