// Constants shared between the build script, the fetch script, and the
// Playwright spec. Run by Node directly via `--experimental-strip-types`
// (Node 22.6+); imported by Playwright's TS pipeline for the spec.

/**
 * Pinned wasmer SHA. To bump:
 *   1. Update the constant here.
 *   2. Re-run `npm run test:prepare:wasmer` to refresh the vendored
 *      `tests/wasix-vendor/wasmer/` checkout.
 *   3. Run the consistency spec (`wasix-suite-consistency.spec.ts`) — it
 *      fails if any new upstream test dir is missing from both
 *      `WASIX_INCLUDE_DIRS` and `WASIX_BUILD_EXCLUDES`.
 *   4. Triage any newly-failing tests into `wasix-suite.skip.ts`.
 */
export const WASMER_SHA = "261a337d428148a9f06884c10478dd634a1f1da7";

/**
 * Relative path (from `packages/wasi/`) where the vendored wasmer checkout
 * lives. Kept out of git — `.gitignore` excludes `tests/wasix-vendor/`.
 */
export const WASIX_VENDOR_DIR = "tests/wasix-vendor";

/**
 * Output directory for built .wasm binaries, relative to `packages/wasi/`.
 * The Playwright spec fetches from `/bin/wasix-tests/<name>.wasm`.
 */
export const WASIX_SUITE_BIN_DIR = "public/bin/wasix-tests";

/**
 * Validation contract (audited 2026-07 against WASMER_SHA):
 *
 * Upstream `run.sh` scripts validate in one or both of two ways —
 *   1. Exit code: `set -e` plus the binary exiting non-zero on failure.
 *      Every included test's `main.c` self-asserts (assert / exit(1) /
 *      EXIT_FAILURE paths); none rely solely on host-side checks.
 *   2. Stdout diff: `$WASMER_RUN main.wasm … > output` followed by
 *      `printf "<expected>" | diff -u output -`. Most included tests
 *      use this — the binary usually prints "0" (no newline) on
 *      success. Exit-code-only checking is NOT sufficient for these
 *      (`closing-pre-opened-dirs` passed vacuously for months that
 *      way); the Playwright spec parses the printf/diff pattern out of
 *      run.sh and asserts stdout equality per run. Scripts WITHOUT
 *      `set -e` ignore guest exit codes entirely (`exception` exits 42
 *      by design) — the spec mirrors that rule too.
 *
 * Additional harness caveats discovered in the audit:
 *   - Several run.sh scripts invoke the binary multiple times with
 *     different subcommands (`udp` ×4, `vfork` ×9, `popen` ×3,
 *     `posix_spawn` ×3). The spec runs every `$WASMER_RUN main.wasm`
 *     line, sharing the volume filesystem state across invocations the
 *     way the wasmer runner's host mount does.
 *   - `popen` / `posix_spawn` / `vfork` compile inside run.sh with
 *     special flags (WASIXCC_WASM_EXCEPTIONS / WASIXCC_PIC / wasm-opt
 *     --asyncify). Our generic `wasixcc -O2` build corresponds to the
 *     non-asyncified variant, which is the variant upstream runs for the
 *     invocations we replicate. vfork's `main-eh.wasm` variant is not
 *     reproduced.
 *   - `symlink-open-read-write` pre-seeds `target.txt` via run.sh and
 *     post-asserts its content on the host side; the harness must
 *     synthesise that input when the test is unskipped.
 *   - `fs-mount` validates three mount mechanisms (--volume, wasmer.toml,
 *     webc); only the `--volume` invocation is reproducible here.
 */

/**
 * Hand-maintained list of `wasmer/tests/wasix/<dir>` test cases the build
 * harness will compile and the Playwright spec will run.
 *
 * Together with `WASIX_BUILD_EXCLUDES` this must exactly cover the test
 * directories in the vendored checkout — the consistency spec enforces
 * the partition, so a SHA bump that adds upstream tests fails loudly
 * instead of silently shrinking coverage.
 *
 * Keep alphabetised.
 */
export const WASIX_INCLUDE_DIRS: readonly string[] = [
  "cloexec",
  "closing-pre-opened-dirs",
  "context-switching",
  "create-and-remove-dirs",
  "create-dir-at-cwd",
  "create-dir-at-cwd-with-chdir",
  "cross-fs-rename",
  "cwd-to-home",
  "distinct-inodes-same-basename",
  "exception",
  "fd-close",
  "fork",
  "fs-mount",
  "fstatat-with-chdir",
  "mount-tmp-locally",
  "msync-end-of-file",
  "msync-middle-of-file",
  "msync-start-of-file",
  "munmap-sync-end-of-file",
  "munmap-sync-middle-of-file",
  "munmap-sync-start-of-file",
  "open-under-file",
  "pipes",
  "popen",
  "posix_spawn",
  "proc-exec",
  "proc-exec2",
  "pwrite-and-size",
  "read-after-munmap",
  "setjmp-longjmp",
  "share-tmp-after-fork",
  "share-tmp-after-proc-exec",
  "share-tmp-after-proc-exec2",
  "shared-fd",
  "signal",
  "symlink-open-read-write",
  "udp",
  "vfork",
];

/**
 * Why a vendored upstream test is not built.
 *
 * - `dynamic-linking-build` — the test builds multiple artifacts
 *   (`-Wl,-shared` side libraries plus a `-Wl,-pie` main) and exercises
 *   runtime dynamic linking (`dlopen`/`dlsym`), which needs both a
 *   multi-artifact build harness and runtime dynamic-linking support
 *   that Runno does not have. Everything else in the vendored suite
 *   builds with the upstream `test.sh` flags (verified empirically with
 *   wasixcc v0.4.3 on 2026-07-30).
 */
export type BuildExcludeReason = "dynamic-linking-build";

export type BuildExcludeEntry = {
  reason: BuildExcludeReason;
  /** Symbols or features the test needs, for triage greps. */
  note: string;
};

/**
 * Every vendored test dir that is deliberately NOT built. The
 * consistency spec asserts `WASIX_INCLUDE_DIRS ∪ WASIX_BUILD_EXCLUDES`
 * exactly equals the vendored directory set (and that they don't
 * overlap). Keep alphabetised.
 */
export const WASIX_BUILD_EXCLUDES: Record<string, BuildExcludeEntry> = {
  "dl-cache": {
    reason: "dynamic-linking-build",
    note: "dlopen/dlsym; builds libside1.so/libside2.so + pie main",
  },
  "dl-needed": {
    reason: "dynamic-linking-build",
    note: "dlopen/dlsym + DT_NEEDED chain; multi-.so build",
  },
  "dl-tls": {
    reason: "dynamic-linking-build",
    note: "TLS across shared libraries; multi-.so build",
  },
  dlopen: {
    reason: "dynamic-linking-build",
    note: "dlopen/dlsym; builds libside.so + pie main",
  },
};
