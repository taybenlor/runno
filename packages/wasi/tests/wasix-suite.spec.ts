// Wasmer wasix integration suite runner.
//
// Iterates over every `.wasm` under `public/bin/wasix-tests/` that the
// build harness produced, replicates each upstream `run.sh` invocation
// through `WASIX.start` in each browser project, and asserts the same
// things the upstream runner asserts:
//
//   1. Exit code 0 for every `$WASMER_RUN main.wasm …` invocation that
//      upstream doesn't mark `|| true`.
//   2. When run.sh validates stdout via the
//      `$WASMER_RUN main.wasm … > output` + `printf "…" | diff -u output -`
//      pattern, the captured stdout must byte-equal the printf payload.
//      (20 of the included tests print "0" on success — exit code alone
//      would be vacuous for them.)
//
// Tests listed in `WASIX_SUITE_SKIPS` are marked `test.fail()` with the
// structured reason token — they still execute, so the Playwright report
// flags "passed unexpectedly" the moment a capability lands and the skip
// entry goes stale.
//
// Per-test wiring:
//   - Each wasmer test directory ships a `run.sh` containing one or more
//     `$WASMER_RUN main.wasm --volume . -- <subcommand tokens>` lines
//     (possibly prefixed with `timeout …`). Every such line becomes one
//     invocation; the tokens after `--` are that invocation's argv.
//     Lines that run other artifacts (main-eh.wasm, .webc packages) or
//     wasixcc compile steps are not replicated — see the audit notes in
//     `wasix-suite.constants.ts`.
//   - `--volume .` maps the test directory's input files (everything
//     beyond `main.c` / `run.sh`) into the guest's preopen tree. The
//     wasmer runner mounts `--volume .` at `/home` because that's
//     wasix-libc's compiled-in default cwd, so the harness mirrors
//     that: inputs are seeded under `/home/<rel-path>`, the FS
//     provider exposes `/home` as a preopen at fd 4, and `PWD` is set
//     so libc's startup path resolver finds the cwd before calling
//     `getcwd`.
//   - Filesystem state persists ACROSS invocations within one test
//     (mirroring the wasmer runner, where every invocation mounts the
//     same host directory), and is fresh BETWEEN tests.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

import type {
  WASIX,
  WASIXContext,
  WASIDriveFileSystemProvider,
  WASIFS,
} from "../lib/main";
import { WASIX_SUITE_BIN_DIR, WASIX_VENDOR_DIR } from "./wasix-suite.constants";
import type { SkipEntry } from "./wasix-suite.skip";
import { WASIX_SUITE_SKIPS } from "./wasix-suite.skip";

const pkgDir = process.cwd();
const binDir = join(pkgDir, WASIX_SUITE_BIN_DIR);
const wasixTestsDir = join(
  pkgDir,
  WASIX_VENDOR_DIR,
  "wasmer",
  "tests",
  "wasix",
);

/**
 * Files the wasmer runner produces at runtime in the test directory
 * (the `--volume .` mount is the test source dir, into which wasmer
 * also writes `main.wasm` and the redirected `output` capture). They
 * are not present on disk for us to read, so the harness synthesises
 * empty placeholders alongside the on-disk inputs. Tests that
 * iterate the cwd listing (e.g. `closing-pre-opened-dirs`) assert
 * against these names.
 */
const SYNTHESIZED_RUNTIME_FILES = ["main.wasm", "output"] as const;

type TestInput = {
  /** Path inside the guest filesystem, relative to the preopen ("."). */
  path: string;
  /** Raw bytes, serialisable across `page.evaluate`. */
  bytes: number[];
};

type Invocation = {
  /** Guest argv (excluding argv[0]; the runtime prepends the name). */
  args: string[];
  /** True when the run line redirects stdout to the `output` capture. */
  capturesOutput: boolean;
  /** Upstream suffixes the line with `|| true` — failure tolerated. */
  mayFail: boolean;
};

type TestPlan = {
  name: string;
  wasmUrl: string;
  /**
   * Whether run.sh sets `set -e`. With it, every invocation must exit 0
   * (any failure fails the upstream script). Without it, upstream's
   * validation is the stdout diff alone when present — the guest's exit
   * code is not observed (e.g. `exception` exits 42 by design) — or,
   * with no diff either, the script's status is its last command's.
   */
  hasSetE: boolean;
  /** One entry per `$WASMER_RUN main.wasm` line in run.sh, in order. */
  invocations: Invocation[];
  /**
   * Expected stdout for output-capturing invocations, parsed from the
   * `printf "…" | diff -u output -` validation line. Null when run.sh
   * validates by exit code only.
   */
  expectedStdout: string | null;
  inputs: TestInput[];
  /**
   * Absolute guest paths that the wasmer runner mounts via
   * `--volume host:guest` (e.g. `/data`, `/temp1`). The harness
   * pre-seeds each as an empty directory so file ops under those
   * mounts pass POSIX parent-exists checks.
   */
  mounts: string[];
};

type InvocationResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function listWasmBinaries(): string[] {
  try {
    return readdirSync(binDir)
      .filter((name) => name.endsWith(".wasm"))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Normalised, comment-free, continuation-joined lines of a run.sh.
 */
function runShLines(source: string): string[] {
  return (
    source
      .split("\n")
      .filter((line) => !line.startsWith("#!") && !/^\s*#/.test(line))
      .map((line) => line.trimEnd())
      .join("\n")
      // Join backslash-continued lines.
      .replace(/\\\n/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );
}

/**
 * Parse every `$WASMER_RUN main.wasm …` line into an invocation. Lines
 * running other artifacts (main-eh.wasm, webc packages, bare `.`) and
 * wasixcc/wasm-opt compile steps are intentionally not replicated.
 */
function parseInvocations(source: string): Invocation[] {
  const invocations: Invocation[] = [];
  for (const line of runShLines(source)) {
    let tokens = shellSplit(line);

    // `|| true` suffix — upstream tolerates the failure.
    let mayFail = false;
    if (
      tokens.length >= 2 &&
      tokens[tokens.length - 2] === "||" &&
      tokens[tokens.length - 1] === "true"
    ) {
      mayFail = true;
      tokens = tokens.slice(0, -2);
    }

    // The runner token may be prefixed (e.g. `timeout -s 9 -v 5 $WASMER_RUN …`).
    // `main-not-asyncified.wasm` (posix_spawn) is upstream's plain build —
    // the same artifact our harness produces as <name>.wasm.
    const runnerIdx = tokens.indexOf("$WASMER_RUN");
    const artifact = tokens[runnerIdx + 1];
    if (
      runnerIdx === -1 ||
      (artifact !== "main.wasm" && artifact !== "main-not-asyncified.wasm")
    ) {
      continue;
    }
    const rest = tokens.slice(runnerIdx + 2);

    // Strip shell redirections, noting the `> output` capture.
    let capturesOutput = false;
    const cleaned: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const tok = rest[i];
      const redirect = /^([12]?>>?)(.*)$/.exec(tok);
      if (redirect) {
        const target = redirect[2] !== "" ? redirect[2] : rest[++i];
        if (redirect[1] === ">" && target === "output") {
          capturesOutput = true;
        }
        continue;
      }
      cleaned.push(tok);
    }

    const sep = cleaned.indexOf("--");
    const args = sep === -1 ? [] : cleaned.slice(sep + 1);
    invocations.push({ args, capturesOutput, mayFail });
  }
  return invocations;
}

/**
 * Extract the expected stdout from the upstream validation line
 * `printf "<payload>" | diff -u output -`. Returns null when run.sh has
 * no such line (exit-code-only validation). Decodes the printf escapes
 * that appear upstream (\n, \t, \\).
 */
function parseExpectedStdout(source: string): string | null {
  const match =
    /printf\s+"((?:[^"\\]|\\.)*)"\s*\|\s*diff\s+-u\s+output\s+-/.exec(source);
  if (!match) return null;
  return match[1]
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

/**
 * Extract the absolute guest paths that the wasmer run.sh mounts via
 * `--volume host:guest` (or `--volume=host:guest`). A bare
 * `--volume host` (no colon) maps to wasix-libc's default cwd
 * (`/home`) and is already handled by the input seeding, so it is
 * skipped here.
 *
 * Used to pre-seed mount-point directories in the in-memory FS so
 * `open(O_CREAT)` under those mounts passes the drive's POSIX
 * parent-exists check (the wasmer runner provides them implicitly).
 */
function parseRunShVolumeMounts(source: string): string[] {
  const targets: string[] = [];
  for (const line of runShLines(source)) {
    const tokens = shellSplit(line);
    if (tokens.indexOf("$WASMER_RUN") === -1) continue;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      let arg: string | undefined;
      if (tok === "--volume" || tok === "--mapdir") {
        arg = tokens[i + 1];
        i++;
      } else if (tok.startsWith("--volume=") || tok.startsWith("--mapdir=")) {
        arg = tok.slice(tok.indexOf("=") + 1);
      } else {
        continue;
      }
      if (!arg) continue;
      const colon = arg.indexOf(":");
      if (colon === -1) continue;
      const guest = arg.slice(colon + 1);
      if (guest.startsWith("/") && !targets.includes(guest)) {
        targets.push(guest);
      }
    }
  }
  return targets;
}

/**
 * Minimal POSIX-style tokeniser: splits on whitespace, honours single
 * and double quotes, and treats `\<ch>` as a literal. Does not expand
 * variables or globs — wasmer `run.sh` scripts are trivial enough that
 * literal tokens survive intact.
 */
function shellSplit(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else cur += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      else if (ch === "\\" && i + 1 < input.length) {
        cur += input[++i];
      } else cur += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === "\\" && i + 1 < input.length) {
      cur += input[++i];
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur.length > 0) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/**
 * Walk `dir` recursively and return every regular file's bytes keyed by
 * path relative to `dir`. Used to seed the per-test preopen from the
 * test directory's non-source inputs.
 */
function collectInputs(dir: string): TestInput[] {
  if (!existsSync(dir)) return [];
  const out: TestInput[] = [];
  const walk = (sub: string) => {
    for (const entry of readdirSync(join(dir, sub))) {
      const rel = sub === "" ? entry : `${sub}/${entry}`;
      const abs = join(dir, rel);
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(rel);
        continue;
      }
      if (!st.isFile()) continue;
      const bytes = readFileSync(abs);
      out.push({ path: rel, bytes: Array.from(bytes) });
    }
  };
  walk("");
  // Append empty placeholders for the runtime artefacts that wasmer
  // would otherwise produce in the test directory (the binary itself
  // and the captured `output`). Tests that iterate cwd contents
  // assert these names, but our harness fetches the wasm separately
  // and never produces an output file.
  for (const synthetic of SYNTHESIZED_RUNTIME_FILES) {
    if (out.some((existing) => existing.path === synthetic)) continue;
    out.push({ path: synthetic, bytes: [] });
  }
  return out;
}

function planForTest(name: string): TestPlan {
  const srcDir = join(wasixTestsDir, name);
  const runShPath = join(srcDir, "run.sh");
  let invocations: Invocation[] = [];
  let expectedStdout: string | null = null;
  let mounts: string[] = [];
  let hasSetE = false;
  if (existsSync(runShPath)) {
    const source = readFileSync(runShPath, "utf8");
    invocations = parseInvocations(source);
    expectedStdout = parseExpectedStdout(source);
    mounts = parseRunShVolumeMounts(source);
    hasSetE = /^set -e/m.test(source);
  }
  if (invocations.length === 0) {
    // A binary with no parseable run line still gets one plain run so
    // the suite never silently skips execution.
    invocations = [{ args: [], capturesOutput: false, mayFail: false }];
  }
  return {
    name,
    wasmUrl: `/bin/wasix-tests/${name}.wasm`,
    hasSetE,
    invocations,
    expectedStdout,
    inputs: collectInputs(srcDir),
    mounts,
  };
}

const binaries = listWasmBinaries();

test.describe("wasix integration suite (wasmer/tests/wasix)", () => {
  test("at least one wasix-suite binary was built", () => {
    expect(
      binaries.length,
      "public/bin/wasix-tests/ is empty — run `npm run test:prepare:wasix-suite` " +
        "(install wasixcc via `npm run wasix:install-tools` first).",
    ).toBeGreaterThan(0);
  });

  if (binaries.length === 0) {
    return;
  }

  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
    await page.waitForLoadState("domcontentloaded");
  });

  for (const file of binaries) {
    const name = file.replace(/\.wasm$/, "");
    const skip: SkipEntry | undefined = WASIX_SUITE_SKIPS[name];

    const plan = planForTest(name);

    test(`wasix-suite: ${name}`, async ({ page }) => {
      if (skip) {
        test.info().annotations.push({
          type: "wasix-skip",
          description: skip.note
            ? `${skip.reason} — ${skip.note}`
            : skip.reason,
        });
        // fail (not fixme): the test still runs, so a capability landing
        // upstream of a stale skip entry shows up as "passed unexpectedly".
        test.fail(true, `wasix-skip:${skip.reason}`);
      }

      const results: InvocationResult[] = await page.evaluate(
        async (p: TestPlan) => {
          while (
            (window as unknown as { WASIX?: unknown })["WASIX"] === undefined
          ) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          const w = window as unknown as {
            WASIX: typeof WASIX;
            WASIXContext: typeof WASIXContext;
            WASIDriveFileSystemProvider: typeof WASIDriveFileSystemProvider;
          };
          const W = w.WASIX;
          const WC = w.WASIXContext;
          const WD = w.WASIDriveFileSystemProvider;

          // Seed a fresh WASIFS under /home for this test — the wasmer
          // runner mounts `--volume .` at /home (wasix-libc's default
          // cwd), so per-test inputs land at /home/<rel-path>. The
          // provider exposes /home as a preopen at fd 4 alongside the
          // implicit fd 3 = ".", and PWD primes the libc startup
          // resolver before it falls back to getcwd().
          const now = new Date();
          const fs: WASIFS = {};
          for (const input of p.inputs) {
            const guestPath = `/home/${input.path}`;
            fs[guestPath] = {
              path: guestPath,
              timestamps: { access: now, modification: now, change: now },
              mode: "binary",
              content: new Uint8Array(input.bytes),
            };
          }

          // Pre-seed each `--volume host:guest` target plus the implicit
          // `/tmp` MemFS mount as empty directories. The WASIDrive uses
          // `.runno` sentinel files to model directory presence, so the
          // mount points appear as real dirs to subsequent path ops
          // (POSIX parent-exists checks). Mirrors what the wasmer runner
          // provides without requiring per-test harness wiring.
          for (const guest of ["/tmp", ...p.mounts]) {
            const trimmed = guest.endsWith("/") ? guest.slice(0, -1) : guest;
            if (!trimmed) continue;
            const marker = `${trimmed}/.runno`;
            fs[marker] = {
              path: marker,
              timestamps: { access: now, modification: now, change: now },
              mode: "string",
              content: "",
            };
          }

          const preopens = [{ name: "/home", prefix: "/home/" }];
          // The wasmer runner mounts the same host directory for every
          // invocation in run.sh, so file state persists across
          // invocations within a test. Reuse the drive between runs;
          // each invocation gets a fresh provider (fresh fd table) over
          // the same underlying files.
          let provider = new WD(fs, { preopens });

          const results: Array<{
            exitCode: number;
            stdout: string;
            stderr: string;
          }> = [];

          // Fetch once; each invocation restarts the module from a
          // fresh instance via WASIX.start on a cloned Response.
          const wasmResponse = await fetch(p.wasmUrl);
          const wasmBytes = await wasmResponse.arrayBuffer();

          for (const invocation of p.invocations) {
            let stdout = "";
            let stderr = "";
            const wasiResult = await W.start(
              Promise.resolve(new Response(wasmBytes.slice(0))),
              new WC({
                args: invocation.args,
                env: { PWD: "/home" },
                stdout: (out: string) => {
                  stdout += out;
                },
                stderr: (err: string) => {
                  stderr += err;
                },
                stdin: () => null,
                fs: provider,
              }),
            );
            results.push({ exitCode: wasiResult.exitCode, stdout, stderr });
            provider = new WD(provider.drive, { preopens });
          }

          return results;
        },
        plan,
      );

      expect(results.length).toBe(plan.invocations.length);
      for (let i = 0; i < results.length; i++) {
        const invocation = plan.invocations[i];
        const result = results[i];
        const isLast = i === results.length - 1;
        const label =
          `invocation ${i + 1}/${results.length}` +
          ` (args: ${JSON.stringify(invocation.args)})` +
          `\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;

        // Mirror the upstream script's own success condition (see
        // TestPlan.hasSetE): `set -e` scripts require every invocation
        // to exit 0; scripts without it validate via the stdout diff
        // when one exists, else via the last command's exit status.
        if (plan.hasSetE) {
          if (!invocation.mayFail) {
            expect(result.exitCode, label).toBe(0);
          }
        } else if (plan.expectedStdout === null && isLast) {
          expect(result.exitCode, label).toBe(0);
        }
        if (invocation.capturesOutput && plan.expectedStdout !== null) {
          expect(result.stdout, label).toBe(plan.expectedStdout);
        }
      }
    });
  }
});
