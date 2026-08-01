/**
 * Downloads external Component Model test suites and converts them into
 * a form the harness can run:
 *
 * 1. Wasmtime's component-model wast suite
 *    (tests/misc_testsuite/component-model/*.wast) — behavioral
 *    conformance tests with assert_return/assert_trap directives.
 *    Converted to JSON + component binaries via `wasm-tools
 *    json-from-wast`.
 *
 * Usage:
 *   node --experimental-strip-types scripts/fetch-external-suites.ts
 * Requires wasm-tools 1.2xx+ (WASM_TOOLS env var or on PATH) and network
 * access. Downloads are cached; re-running only fetches missing files.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcDir = `${root}tests/external/wast-src`;
const outDir = `${root}tests/fixtures/external`;
const wasmTools = process.env.WASM_TOOLS ?? "wasm-tools";

const WASMTIME_RAW =
  "https://raw.githubusercontent.com/bytecodealliance/wasmtime/main/tests/misc_testsuite/component-model";

/**
 * The top-level wast files in wasmtime's component-model suite. The
 * async/ and gc/ subdirectories are excluded until the runtime supports
 * those proposals.
 */
const WASMTIME_WAST_FILES = [
  "adapter.wast",
  "aliasing.wast",
  "big-strings.wast",
  "enum_discriminant.wast",
  "enums.wast",
  "error-context-trap-in-post-return.wast",
  "exceptions.wast",
  "fixed_length_lists.wast",
  "implements-disabled.wast",
  "implements.wast",
  "import.wast",
  "instance.wast",
  "linking.wast",
  "map-types.wast",
  "memory64.wast",
  "modules.wast",
  "nested-many-instantiations.wast",
  "nested.wast",
  "resources.wast",
  "restrictions.wast",
  "simple.wast",
  "string-transcode-invalid.wast",
  "strings.wast",
  "tags.wast",
  "trap.wast",
  "types.wast",
];

async function download(url: string, path: string): Promise<void> {
  if (existsSync(path)) {
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url}: ${response.status}`);
  }
  writeFileSync(path, new Uint8Array(await response.arrayBuffer()));
  console.log(`fetched ${url.split("/").at(-1)}`);
}

mkdirSync(srcDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const manifest: { name: string; json: string }[] = [];

for (const file of WASMTIME_WAST_FILES) {
  const base = file.replace(/\.wast$/, "");
  const wastPath = `${srcDir}/${file}`;
  try {
    await download(`${WASMTIME_RAW}/${file}`, wastPath);
  } catch (e) {
    console.warn(`skipping ${file}: ${(e as Error).message}`);
    continue;
  }
  const caseDir = `${outDir}/${base}`;
  mkdirSync(caseDir, { recursive: true });
  try {
    execFileSync(wasmTools, [
      "json-from-wast",
      wastPath,
      "--wasm-dir",
      caseDir,
      "-o",
      `${caseDir}/commands.json`,
    ]);
    manifest.push({ name: base, json: `${base}/commands.json` });
  } catch (e) {
    console.warn(`json-from-wast failed for ${file}: ${(e as Error).message}`);
  }
}

writeFileSync(
  `${outDir}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);

const total = readdirSync(outDir).length - 1;
console.log(`prepared ${manifest.length} wast suites in ${total} dirs`);
