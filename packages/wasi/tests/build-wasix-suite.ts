#!/usr/bin/env node
// Build the wasmer/tests/wasix integration suite into
// `public/bin/wasix-tests/<name>.wasm`.
//
// Pre-conditions (prepared by package.json scripts):
//   - The vendored wasmer checkout exists at `tests/wasix-vendor/wasmer/`
//     at the SHA pinned in `wasix-suite.constants.ts`.
//   - `wasixcc` is on PATH. Locally: `npm run wasix:install-tools`.
//
// Behaviour mirrors upstream `wasmer/tests/wasix/test.sh`:
//   - C tests build with `wasixcc -sWASM_EXCEPTIONS=false <sources>`,
//     C++ tests (main.cc) with `wasix++ <sources>`. Per-test extra
//     flags come from an optional `.flags` file, exactly like upstream.
//   - Upstream `.no-build` tests compile inside their own run.sh with
//     equivalent flags (WASIXCC_WASM_EXCEPTIONS=no ≈
//     -sWASM_EXCEPTIONS=false); we build them with the plain invocation,
//     which matches the non-exceptions variant that our spec replicates.
//   - If `wasixcc` is missing, the vendor dir is missing, or any
//     individual build fails, exit non-zero. Build failures are not
//     silently absorbed: the fix is to repair the build, not to skip.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  WASIX_INCLUDE_DIRS,
  WASIX_SUITE_BIN_DIR,
  WASIX_VENDOR_DIR,
} from "./wasix-suite.constants.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(__dirname, "..");

const vendorRoot = join(pkgDir, WASIX_VENDOR_DIR, "wasmer", "tests", "wasix");
const outDir = join(pkgDir, WASIX_SUITE_BIN_DIR);

mkdirSync(outDir, { recursive: true });

const wasixcc = resolveWasixcc();
if (!wasixcc) {
  console.error(
    "[build-wasix-suite] wasixcc not found on PATH.\n" +
      "  Install via `npm run wasix:install-tools` (or follow " +
      "https://github.com/wasix-org/wasix-libc) and re-run.",
  );
  process.exit(1);
}

if (!existsSync(vendorRoot)) {
  console.error(
    `[build-wasix-suite] vendor directory missing: ${vendorRoot}\n` +
      "  Run `npm run test:prepare:wasmer` first.",
  );
  process.exit(1);
}

let built = 0;
let failed = 0;
const buildFailures: string[] = [];

for (const name of WASIX_INCLUDE_DIRS) {
  const srcDir = join(vendorRoot, name);
  if (!existsSync(srcDir)) {
    console.error(
      `[build-wasix-suite] include-list entry missing in vendor: ${name}\n` +
        "  Update WASIX_INCLUDE_DIRS in wasix-suite.constants.ts or " +
        "re-run `npm run test:prepare:wasmer`.",
    );
    process.exit(1);
  }

  const cSources = collectSources(srcDir, ".c");
  const cppSources = collectSources(srcDir, ".cc");
  if (cSources.length === 0 && cppSources.length === 0) {
    console.error(
      `[build-wasix-suite] include-list entry has no C/C++ sources: ${name}\n` +
        "  Drop it from WASIX_INCLUDE_DIRS or fix the vendored checkout.",
    );
    process.exit(1);
  }

  const outPath = join(outDir, `${name}.wasm`);
  const extraFlags = readFlags(srcDir);

  // Mirror upstream test.sh:
  //   wasix++ main.cc -o main.wasm ${extra_flags}          (C++ tests)
  //   wasixcc -sWASM_EXCEPTIONS=false main.c ... ${flags}  (C tests)
  // Plus -Wno-error=implicit-function-declaration: several upstream
  // tests call fork() etc. without the right headers and wasixcc's
  // clang rejects the implicit declarations as errors by default.
  const isCpp = cppSources.length > 0;
  const compiler = isCpp ? "wasix++" : wasixcc;
  const args = [
    ...(isCpp ? [] : ["-sWASM_EXCEPTIONS=false"]),
    "-Wno-error=implicit-function-declaration",
    "-o",
    outPath,
    ...(isCpp ? cppSources : cSources),
    ...extraFlags,
  ];

  const result = spawnSync(compiler, args, {
    stdio: ["ignore", "inherit", "inherit"],
  });

  if (result.status === 0) {
    built++;
    console.log(`[build-wasix-suite] built: ${name}`);
  } else {
    failed++;
    buildFailures.push(name);
    console.error(
      `[build-wasix-suite] FAILED (exit ${result.status}): ${name}`,
    );
  }
}

console.log(`[build-wasix-suite] summary: built=${built} failed=${failed}`);

if (failed > 0) {
  console.error(
    `[build-wasix-suite] ${failed} test(s) failed to build: ${buildFailures.join(", ")}\n` +
      "  Fix the build — do not skip.",
  );
  process.exit(1);
}

if (built === 0) {
  console.error(
    "[build-wasix-suite] produced zero binaries — vendor dir empty or " +
      "include list is empty. Check `npm run test:prepare:wasmer`.",
  );
  process.exit(1);
}

/** Resolve `wasixcc` from PATH — returns null if not installed. */
function resolveWasixcc(): string | null {
  const probe = spawnSync("wasixcc", ["--version"], {
    stdio: ["ignore", "ignore", "ignore"],
  });
  return probe.status === 0 ? "wasixcc" : null;
}

/** Collect source files with the given extension directly under `dir`. */
function collectSources(dir: string, ext: ".c" | ".cc"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isFile()) continue;
    if (entry.endsWith(ext)) out.push(full);
  }
  return out;
}

/** Read the upstream per-test `.flags` file (whitespace-separated). */
function readFlags(dir: string): string[] {
  const flagsPath = join(dir, ".flags");
  if (!existsSync(flagsPath)) return [];
  return readFileSync(flagsPath, "utf8")
    .split(/\s+/)
    .filter((f) => f.length > 0);
}
