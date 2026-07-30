// Skip map for the wasmer/tests/wasix integration suite.
//
// Each entry is keyed by the test directory name (matching the `.wasm`
// stem under `public/bin/wasix-tests/`). Tests listed here are marked
// `test.fail()` by the Playwright spec with a structured reason token —
// they still RUN, so the report flags "passed unexpectedly" the moment a
// capability lands and an entry goes stale.
//
// Scope rule (enforced by `wasix-suite-consistency.spec.ts`): every key
// here must be a member of `WASIX_INCLUDE_DIRS` — i.e. a test that is
// actually built and executed. Tests that cannot even be built live in
// `WASIX_BUILD_EXCLUDES` in the constants file instead; tests that don't
// exist in the vendored checkout must not appear anywhere.
//
// Reason tokens are drawn from the fixed union below. The token names are
// a grep contract: `grep requires-provider-sockets` is meant to return
// every test blocked on that capability so a later change can flip the
// entries atomically when the provider lands.

/**
 * Fixed reason vocabulary. Pick the most specific match. Do **not**
 * extend this union without matching plan + issue discussion — the
 * tokens are shared across the whole suite.
 *
 * - `requires-asyncify`            — needs Asyncify (e.g. post-fork longjmp).
 * - `requires-provider-sockets`    — needs SocketsProvider.
 * - `requires-provider-threads`    — needs ThreadsProvider.
 * - `requires-provider-futex`      — needs FutexProvider.
 * - `requires-provider-signals`    — needs SignalsProvider.
 * - `requires-provider-proc`       — needs ProcProvider / proc_fork /
 *                                    proc_exec / proc_spawn.
 * - `requires-drive-feature`       — needs a WASIDrive capability that is
 *                                    not modelled yet (mmap/msync,
 *                                    symlinks, hard links, mount, fd-table
 *                                    extraction). See WASIX-PLAN.md
 *                                    "Drive feature workstream".
 */
export type SkipReason =
  | "requires-asyncify"
  | "requires-provider-sockets"
  | "requires-provider-threads"
  | "requires-provider-futex"
  | "requires-provider-signals"
  | "requires-provider-proc"
  | "requires-drive-feature";

export type SkipEntry = {
  reason: SkipReason;
  /** Optional free-form note — triage link, upstream bug, etc. */
  note?: string;
};

/**
 * Skip map: `<test-name>` → skip reason.
 *
 * Keep entries alphabetised; `wasix-suite.spec.ts` reads this map and
 * marks each matching test `test.fail(true, reason)`.
 */
export const WASIX_SUITE_SKIPS: Record<string, SkipEntry> = {
  cloexec: {
    reason: "requires-asyncify",
    note: "fork + popen; post-fork child execution needs stack reification.",
  },
  "closing-pre-opened-dirs": {
    reason: "requires-drive-feature",
    note:
      "guest fcloses stdout and expects later writes to vanish; stdio " +
      "fds route to host callbacks and never close. Surfaced by the " +
      "stdout-diff assertion (previously passed vacuously on exit code " +
      "alone). Pending the fd-table extraction.",
  },
  "context-switching": {
    reason: "requires-asyncify",
    note:
      "userspace context_create/context_switch — needs the guest stack " +
      "reified, same blocker class as Asyncify. Also uses fork/vfork.",
  },
  "fd-close": {
    reason: "requires-provider-sockets",
    note:
      "test opens a TCP socket via socket(AF_INET, SOCK_STREAM) and " +
      "expects close(fd) plus EBADF on second close. Needs " +
      "SocketsProvider + /bin preopen.",
  },
  fork: {
    reason: "requires-asyncify",
    note: "post-fork execution in the child needs stack reification.",
  },
  "fs-mount": {
    reason: "requires-drive-feature",
    note:
      "mount syscall; Runno has a single preopen root. Only the " +
      "--volume invocation of upstream run.sh is replicated here.",
  },
  "msync-end-of-file": {
    reason: "requires-drive-feature",
    note: "mmap / msync — WASIDrive doesn't model file-backed mappings.",
  },
  "msync-middle-of-file": {
    reason: "requires-drive-feature",
    note: "mmap / msync — WASIDrive doesn't model file-backed mappings.",
  },
  "msync-start-of-file": {
    reason: "requires-drive-feature",
    note: "mmap / msync — WASIDrive doesn't model file-backed mappings.",
  },
  "munmap-sync-end-of-file": {
    reason: "requires-drive-feature",
    note: "mmap / munmap — WASIDrive doesn't model file-backed mappings.",
  },
  "munmap-sync-middle-of-file": {
    reason: "requires-drive-feature",
    note: "mmap / munmap — WASIDrive doesn't model file-backed mappings.",
  },
  "munmap-sync-start-of-file": {
    reason: "requires-drive-feature",
    note: "mmap / munmap — WASIDrive doesn't model file-backed mappings.",
  },
  pipes: {
    reason: "requires-asyncify",
    note: "fork/vfork-based pipe plumbing.",
  },
  popen: {
    reason: "requires-provider-proc",
    note: "needs proc_spawn2 + proc_join (proc provider).",
  },
  posix_spawn: {
    reason: "requires-provider-proc",
    note: "needs proc_spawn2 + proc_join (proc provider).",
  },
  "proc-exec": {
    reason: "requires-asyncify",
    note: "fork then execv; the child resumes post-fork before exec.",
  },
  "proc-exec2": {
    reason: "requires-asyncify",
    note: "fork then execve; the child resumes post-fork before exec.",
  },
  "read-after-munmap": {
    reason: "requires-drive-feature",
    note: "mmap / munmap — WASIDrive doesn't model file-backed mappings.",
  },
  "share-tmp-after-fork": {
    reason: "requires-asyncify",
    note: "fork-based; child resumes post-fork.",
  },
  "share-tmp-after-proc-exec": {
    reason: "requires-asyncify",
    note: "fork + execv; child resumes post-fork before exec.",
  },
  "share-tmp-after-proc-exec2": {
    reason: "requires-asyncify",
    note: "fork + execve; child resumes post-fork before exec.",
  },
  "shared-fd": {
    reason: "requires-asyncify",
    note: "fork-based fd sharing; child resumes post-fork.",
  },
  signal: {
    reason: "requires-asyncify",
    note:
      "fork-based signal delivery between processes; fork is the " +
      "harder blocker so it wins the token over provider-signals.",
  },
  "symlink-open-read-write": {
    reason: "requires-drive-feature",
    note:
      "symlinks are not represented in WASIDrive. When unskipped, the " +
      "harness must also pre-seed target.txt ('host-prefix:') and " +
      "post-assert its content — see run.sh.",
  },
  udp: {
    reason: "requires-provider-sockets",
    note: "raw UDP send/recv across 4 subcommand invocations.",
  },
  vfork: {
    reason: "requires-provider-proc",
    note:
      "needs proc_fork_env + proc_exec3 (proc provider). Distinct from " +
      "POSIX vfork — wasix-libc reuses proc_fork semantics. Upstream " +
      "also builds a wasm-exceptions variant (main-eh.wasm) that this " +
      "harness does not reproduce.",
  },
};
