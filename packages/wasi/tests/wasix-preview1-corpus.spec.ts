// Runs the existing preview1 test corpus (caspervonb/wasi-test-suite)
// through WASIX instead of WASI.
//
// Why this exists: WASIX composes a WASI instance internally but
// OVERRIDES nine preview1 imports (fd_prestat_get/dir_name, fd_readdir,
// path_open, path_filestat_get, path_create_directory,
// path_remove_directory, path_unlink_file, path_rename) so they route
// through the FileSystemProvider. preview1 behaviour under WASIX is
// therefore a distinct code path from preview1 under WASI, and the
// corpus that validates WASI never touched it. This spec closes that
// hole — it also exercises the export-memory auto-detect path (corpus
// binaries export their memory rather than importing env.memory).
//
// Expectations are identical to core.spec.ts / libc.spec.ts /
// libstd.spec.ts: exit status from the .status file (default 0), plus
// stdout/stderr golden files when present.

import * as fs from "fs";

import { test, expect } from "@playwright/test";

import type {
  WASIX,
  WASIXContext,
  WASIDriveFileSystemProvider,
} from "../lib/main";
import {
  Suite,
  getArgs,
  getEnv,
  getStatus,
  getStdin,
  getStderr,
  getStdout,
  getFS,
} from "./helpers.js";

const SUITES: Suite[] = ["core", "libc", "libstd"];

/**
 * Corpus tests whose expectations are WASI-shaped in a way WASIX
 * intentionally diverges from. Add entries ONLY for documented semantic
 * differences (with the reason inline), never for convenience.
 */
const WASIX_CORPUS_SKIPS: Record<string, string> = {
  // WASIX deliberately speaks POSIX errno vocabulary: the provider layer
  // translates the drive's ENOTCAPABLE ("not present" / "escapes the
  // preopen") into ENOENT, because wasix-libc consumers and the wasmer
  // suite expect POSIX shapes (see the Slice 3.5 notes and the
  // wasix-fs-provider spec). These three corpus tests assert
  // errno == ENOTCAPABLE specifically, which is preview1-under-WASI
  // behaviour — under WASIX the same operations fail with ENOENT and
  // the guest's assert exits 134. Expected divergence, marked
  // test.fail so any behaviour change is flagged.
  "libc/fopen-directory-parent-directory.wasm":
    "asserts ENOTCAPABLE; WASIX provider layer maps to POSIX ENOENT",
  "libc/fopen-parent-directory.wasm":
    "asserts ENOTCAPABLE; WASIX provider layer maps to POSIX ENOENT",
  "libc/fopen-working-directory.wasm":
    "asserts ENOTCAPABLE; WASIX provider layer maps to POSIX ENOENT",
};

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173");
  await page.waitForLoadState("domcontentloaded");
});

for (const suite of SUITES) {
  let wasmFiles: string[] = [];
  try {
    wasmFiles = fs
      .readdirSync(`public/bin/wasi-test-suite-main/${suite}`)
      .filter((f) => f.endsWith(".wasm"));
  } catch {
    // Missing corpus is surfaced by the guard test below.
  }

  test.describe(`wasix-preview1-corpus/${suite}`, () => {
    test(`corpus is present`, () => {
      expect(
        wasmFiles.length,
        `public/bin/wasi-test-suite-main/${suite} is empty — run ` +
          "`npm run test:download`.",
      ).toBeGreaterThan(0);
    });

    for (const name of wasmFiles) {
      const expectedStatus = getStatus(suite, name);
      const env = getEnv(suite, name);
      // libstd binaries read their own name as argv[0] plus .arg files;
      // mirrors libstd.spec.ts. Harmless for core/libc.
      const args = [name, ...getArgs(suite, name)];
      const stdin = getStdin(suite, name);
      const stdout = getStdout(suite, name);
      const stderr = getStderr(suite, name);
      const testFS = getFS(suite, name);
      const skipReason = WASIX_CORPUS_SKIPS[`${suite}/${name}`];

      test(`${name} exits ${expectedStatus} under WASIX`, async ({ page }) => {
        if (skipReason) {
          test.fail(true, skipReason);
        }

        const result = await page.evaluate(
          async function ({ url, env, args, stdin, testFS }) {
            while ((window as any)["WASIX"] === undefined) {
              await new Promise((resolve) => setTimeout(resolve, 10));
            }

            const W: typeof WASIX = (window as any)["WASIX"];
            const WC: typeof WASIXContext = (window as any)["WASIXContext"];
            const WD: typeof WASIDriveFileSystemProvider = (window as any)[
              "WASIDriveFileSystemProvider"
            ];

            let stderr = "";
            let stdout = "";
            // Chunk stdin by maxByteLength, mirroring libstd.spec.ts —
            // large inputs (io_stdin-beowulf) overflow the guest buffer
            // if returned in one piece.
            let stdinBytes = new TextEncoder().encode(stdin ?? "");
            const wasiResult = await W.start(
              fetch(url),
              new WC({
                args,
                env,
                stdout: (s: string) => {
                  stdout += s;
                },
                stderr: (s: string) => {
                  stderr += s;
                },
                stdin: (maxByteLength: number) => {
                  const chunk = stdinBytes.slice(0, maxByteLength);
                  stdinBytes = stdinBytes.slice(maxByteLength);
                  return new TextDecoder().decode(chunk);
                },
                fs: new WD(testFS),
              }),
            );
            return { exitCode: wasiResult.exitCode, stdout, stderr };
          },
          {
            url: `/bin/wasi-test-suite-main/${suite}/${name}`,
            env,
            args,
            stdin,
            testFS,
          },
        );

        expect(result.exitCode).toBe(expectedStatus);
        if (stdout) {
          expect(result.stdout).toEqual(stdout);
        }
        if (stderr) {
          expect(result.stderr).toEqual(stderr);
        }
      });
    }
  });
}
