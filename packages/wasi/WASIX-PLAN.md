# WASIX support — technical design

_Status: implementation in progress. Slices 1–3.5 have landed (skeleton,
clock/random providers, filesystem provider, module-instantiation
surface). This document describes the target architecture plus the
current validation reality; see [Slice roadmap](#slice-roadmap) for
what's built and what's next._

## Goal

Extend `@runno/wasi` to run WASIX binaries while preserving Runno's existing
sandbox philosophy: the runtime provides marshalling between WASM memory and
JavaScript; the host supplies every semantic via a pluggable provider.
The runtime never performs a real syscall.

> Runno emulates. You simulate.

A host can model threads as a cooperative scheduler, a network as a recorded
trace, `proc_fork` as a canned child handle, or any syscall as `/dev/null`.
All of that is a host-side decision; the runtime is unaware.

## Scope

- WASIX `wasix_32v1` import namespace fully wired up.
- Existing preview1 and unstable imports continue to work for WASIX binaries
  (they import both).
- Clock and Random become overridable providers (enables deterministic
  execution).
- **Pass the upstream WASIX C test suite (`wasmer/tests/wasix` in the
  [wasmer repo](https://github.com/wasmerio/wasmer), vendored at a
  pinned SHA)** using the simulation providers shipped with the
  package. See [Validation](#validation). (An earlier revision named
  `wasmerio/wasix-integration-tests` as the bar; that repo is a
  Rust/snapshot-based suite and is NOT what the harness runs — it
  remains a candidate source of extra coverage, see
  [Coverage gaps](#coverage-gaps-in-the-upstream-suite).)

Every WASIX syscall has a provider slot. Unwired slots return `ENOSYS`.

**Non-goals.**

- Tests requiring Asyncify (or JSPI) instrumentation on the guest module —
  principally `proc_fork` asserting on post-fork execution, asynchronously
  delivered signals that pre-empt running code, and userspace context
  switching (`context_create` / `context_switch`). These need the guest's
  call stack and program counter reified from outside, which WebAssembly
  does not expose to JS. A provider can't supply that at call time.
  Tracked as known-skipped. See
  [Future: Asyncify opt-in](#future-asyncify-opt-in) for the path to
  lifting this.

  _Empirical amendment (2026-07):_ cross-frame `setjmp`/`longjmp` was
  originally in this category, but binaries built with wasm-exceptions
  (`wasixcc`'s exnref EH build, the upstream default for C++) implement
  `setjmp`/`longjmp` on top of wasm EH — the upstream `setjmp-longjmp`
  and `exception` tests **pass in all three browsers today** with no
  Asyncify. Only the asyncify-build variants of those semantics remain
  out of reach.

- `proc_exec` and `proc_spawn` are **not** in this category — they start a
  fresh instance, which a provider can do. Expected to pass.
- Real socket / process / thread implementations baked into the runtime _or_
  shipped as Runno providers. Runno is a sandbox; its providers are
  simulations. A host that wants real-world semantics wires its own
  providers — Runno does not ship them.
- `wasix_64v1` (Memory64 / wasm64). No existing toolchain output drives demand;
  the `wasix-libc` chain targets wasm32 in practice. Deferred — the handler
  code would mostly overlap with `wasix_32v1`, so picking it up later is cheap.

## Public surface

New root exports from `@runno/wasi`:

```ts
// Core
export { WASIX, WASIXContext, WASIXWorkerHost } from "./wasix/...";

// Raw provider interfaces — always synchronous, consumed by `WASIX`
export type {
  ClockProvider,
  RandomProvider,
  TTYProvider,
  ThreadsProvider,
  FutexProvider,
  SignalsProvider,
  SocketsProvider,
  ProcProvider,
} from "./wasix/providers.js";

// Async-capable variants — accepted only by WASIXWorkerHost
export type {
  AsyncClockProvider,
  AsyncRandomProvider,
  AsyncTTYProvider,
  AsyncThreadsProvider,
  AsyncFutexProvider,
  AsyncSignalsProvider,
  AsyncSocketsProvider,
  AsyncProcProvider,
  AsyncCapable,
} from "./wasix/providers/async.js";

// Ergonomic providers — concrete classes hosts can drop in
export {
  HTTPProvider, // AsyncSocketsProvider (Fetch-style) — worker-only (planned)
  WASIDriveFileSystemProvider, // wraps WASIDrive (landed; the plan's
  // earlier name `FileSystemProvider` is the raw interface it implements)
  ConsoleTTYProvider, // TTYProvider (sync) (planned)
} from "./wasix/providers/ergonomic/...";
```

Landed today: `WASIX`, `WASIXContext`, the `WASIX32v1` ABI namespace,
`SystemClockProvider` / `SystemRandomProvider` / `FixedClockProvider` /
`SeededRandomProvider`, and `WASIDriveFileSystemProvider`. The
worker-host surface and remaining providers are future slices.

Existing `WASI`, `WASIContext`, `WASIWorkerHost`, and the
`WASISnapshotPreview1` namespace export are unchanged. This keeps a clean slot
for future `WASIPreview2` / `WASIPreview3` classes alongside.

## Architecture

### Class structure

```
                ┌─────────────────────┐
                │  WASIDrive          │  emulated unix-like FS
                └──────▲──────────────┘
                       │ shared
      ┌────────────────┴─────────────────┐
      │                                  │
┌───────────────┐                  ┌───────────────┐
│  WASI         │                  │  WASIX        │
│  (preview1 +  │  <── delegates ──│  (wasix_32v1) │
│   unstable)   │     preview1/    │               │
│               │     unstable     │               │
└───────────────┘                  └───────────────┘
```

`WASIX` does **not** subclass `WASI`. The two are siblings that share the
drive abstraction (and a small set of memory-helper utilities extracted to a
shared module). `WASIX` composes a `WASI` instance internally to service
preview1/unstable imports, rather than inheriting. This keeps each class's
surface narrow and makes future preview2/preview3 classes independent of
WASIX.

### Import object

`WASIX.getImportObject()` returns:

```ts
{
  wasix_32v1:             { …all WASIX syscalls },
  wasi_snapshot_preview1: <delegated to internal WASI>,
  wasi_unstable:          <delegated to internal WASI>,
}
```

A WASIX binary that imports both `wasix_32v1` and `wasi_snapshot_preview1`
sees a consistent filesystem / env / stdio across the two, because both sets
of handlers are backed by the same `WASIDrive` and `WASIXContext`.
Memory is owned by the WASIX instance and passed to the internal WASI.

### ABI

Mirrors the preview1 approach: `lib/wasix/wasix-32v1.ts` holds the ABI as
TypeScript — enum members, flag masks, struct layouts, errno values — parallel
to how `lib/wasi/snapshot-preview1.ts` defines preview1 today. The `WASIX`
class reads from and writes to guest memory using those definitions; no raw
magic numbers appear in the syscall handlers.

Keeping the ABI in a dedicated module means a future `wasix_64v1` can reuse
the same type definitions with wider pointer offsets, rather than forking the
whole class.

## Context & providers

```ts
type WASIXContextOptions = {
  // File / process basics — same semantics as WASIContext
  fs: WASIFS;
  args: string[];
  env: Record<string, string>;
  stdin: (maxByteLength: number) => string | null;
  stdout: (out: string) => void;
  stderr: (err: string) => void;
  isTTY: boolean;
  debug?: DebugFn;

  // Providers — all sync. Async variants are configured via
  // WASIXWorkerHostOptions; see "Async-capable providers" below.
  clock?: ClockProvider; // clock_time_get, clock_res_get
  random?: RandomProvider; // random_get
  tty?: TTYProvider; // tty_get, tty_set
  threads?: ThreadsProvider; // thread_spawn/join/exit/sleep/id/parallelism/signal
  futex?: FutexProvider; // futex_wait, futex_wake(_all)
  signals?: SignalsProvider; // signal_register, proc_raise_interval
  sockets?: SocketsProvider; // WASIX socket surface (TCP/UDP/resolve)
  proc?: ProcProvider; // proc_id, proc_fork/spawn/exec/join, proc_parent
};
```

Every method uses JS-native shapes — `Uint8Array`, `bigint`, plain objects
for structured types like `SockAddr`. **Raw pointers never leave the
`WASIX` class.**

**Every provider method is synchronous.** The WASM guest calls imports
synchronously and the `WASIX` class never awaits, so the provider API has
no Promise shape at all. A method returns a value or throws — nothing
else. This applies to raw interfaces and to the ergonomic providers built
on top of them.

These are **raw interfaces** — close to the WASIX ABI (fds, `sockaddr`,
signo). A host can implement any raw interface directly if it wants deep
control over that slot. For most hosts Runno ships **ergonomic providers**
(see below) that wrap the raw interfaces in web-native shapes. Both levels
coexist — ergonomic is the one-liner, raw is the escape hatch.

Async resources — HTTP requests, IndexedDB, anything that yields to the
event loop — are handled at the `WASIXWorkerHost` layer, which takes
**async-capable** provider variants (see
[Async-capable providers](#async-capable-providers-worker-only) below) and
converts them back into sync providers via the syscall bridge. The inner
`WASIX` class only ever sees sync providers.

Raw interface shapes (final forms pinned during implementation):

```ts
interface ClockProvider {
  now(id: ClockId): bigint; // nanoseconds
  resolution(id: ClockId): bigint;
}

interface RandomProvider {
  fill(buf: Uint8Array): void;
}

interface ThreadsProvider {
  spawn(startArg: number): number; // tid
  join(tid: number): number; // exit code
  exit(code: number): void;
  sleep(durationNs: bigint): void;
  id(): number;
  parallelism(): number;
  signal(tid: number, signo: number): Result;
}

interface FutexProvider {
  wait(addr: number, expected: number, timeoutNs: bigint | null): number;
  wake(addr: number, count: number): number;
}

interface SocketsProvider {
  open(af: number, type: number, proto: number): number;
  bind(fd: number, addr: SockAddr): Result;
  connect(fd: number, addr: SockAddr): Result;
  listen(fd: number, backlog: number): Result;
  accept(fd: number): number;
  send(fd: number, bufs: Uint8Array[], flags: number): number;
  recv(fd: number, bufs: Uint8Array[], flags: number): SockRecvResult;
  shutdown(fd: number, how: number): Result;
  addrResolve(host: string, port: number, hints: AddrHints): SockAddr[];
  // …getsockopt/setsockopt, addr_local/peer, status
}

interface ProcProvider {
  id(): number;
  parentId(): number;
  fork(): ProcForkResult;
  spawn(req: ProcSpawnRequest): number;
  exec(req: ProcExecRequest): Result;
  join(pid: number): ProcExitInfo;
}

// fork / spawn / exec receive plain-data requests — opaque JS objects
// containing the argv / env / fd table / memory snapshot the provider needs.
// The provider never sees a live `WASIX` instance or the WebAssembly.Memory
// directly; it decides on its own what "starting a new process" means.

interface SignalsProvider {
  register(signo: number, handler: number): Result;
  raiseInterval(signo: number, intervalNs: bigint): Result;
}

interface TTYProvider {
  get(): TTYState; // cols, rows, pixel size, echo, line, raw, …
  set(state: TTYState): Result;
}
```

### Async-capable providers (worker-only)

A single utility type lifts any raw provider into an async-capable variant
by making every method optionally return a Promise:

```ts
type AsyncCapable<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R | Promise<R>
    : T[K];
};

type AsyncClockProvider = AsyncCapable<ClockProvider>;
type AsyncSocketsProvider = AsyncCapable<SocketsProvider>;
// …one per raw provider
```

`WASIXWorkerHost` accepts these variants in its options (stdio callbacks
likewise). At runtime it runs the inner `WASIX` in a dedicated worker;
when a syscall fires, the bridge (see
[Async syscall bridge](#async-syscall-bridge)) hops to the main thread,
invokes the host's async-capable provider, awaits the Promise if one comes
back, and returns the resolved value to the worker. The worker unblocks on
`Atomics.wait` and passes the value into the sync inner `WASIX` as a
normal return.

From the guest and from `WASIX`, there is no async. From the host's
perspective, any provider method may return a Promise.

The main-thread `WASIX(...)` entry point takes sync providers only —
async-capable variants are a type error there.

### Ergonomic providers (bundled)

Raw interfaces are close to the WASIX ABI, which is right for control but
verbose. Runno ships ergonomic providers that implement the raw interfaces
in terms of web-native primitives. Opt-in — the host picks which level of
engagement they want per concern. Deep control over sockets while using the
bundled clock and filesystem is a normal configuration.

- **`HTTPProvider` (implements `AsyncSocketsProvider`).** Most hosts care
  about HTTP, not raw TCP/UDP. `HTTPProvider` exposes two handlers:
  ```ts
  new HTTPProvider({
    outgoing: (req: Request) => Response | Promise<Response>, // guest-initiated
    incoming: (port: number) => ReadableStream<Request>, // guest-bound service
  });
  ```
  Internally it translates socket-level calls (`connect`, `send`, `recv`)
  into Fetch-style request/response pairs and parses HTTP on the wire.
  Because the handlers return Promises, `HTTPProvider` is
  **async-capable** and usable only on `WASIXWorkerHost`. Hosts that need
  raw TCP implement `SocketsProvider` (or its async variant) directly.
- **`FileSystemProvider`.** Promotes the existing `WASIDrive` from an
  internal implementation detail to a public provider. Sync by default
  (today's in-memory drive); an `AsyncFileSystemProvider` variant ships for
  hosts backing files with IndexedDB or a server sync protocol (worker-only).
- **`ConsoleTTYProvider` (implements `TTYProvider`).** Reflects the
  existing `isTTY` / `stdin` / `stdout` / `stderr` surface — what preview1
  hosts configure today, lifted into the provider model. Sync.

Some raw interfaces are already at the right level and don't get an
ergonomic wrapper: `ClockProvider`, `RandomProvider`, `ThreadsProvider`,
`FutexProvider`, `SignalsProvider`, `ProcProvider`. Hosts implement them
directly. Runno still ships bundled simulations for each (see
[Validation](#validation)).

## Async syscall bridge

The bridge is how `WASIXWorkerHost` turns a host's async-capable provider
into the sync provider the inner `WASIX` class consumes. It's an
implementation detail of the worker host — neither `WASIX` nor provider
authors see it; the inner guest runs against pure sync providers.

Mechanism — a generalised version of the existing `stdin` pattern:

1. The host allocates a `SharedArrayBuffer` once per worker; handed to the
   worker at start-up.
2. A syscall inside the worker whose provider returns a Promise: serialises
   its opcode + arguments into a request region, signals the main thread
   with `Atomics.notify`, then blocks on `Atomics.wait`.
3. The main thread's `WASIXWorkerHost` sees the request, dispatches to the
   appropriate provider, awaits the Promise, writes the serialised reply into
   the response region, and notifies the worker.
4. The worker wakes, deserialises the response, writes into WASM memory at
   the original retptrs, and returns to the guest.

One request/response pair per worker is enough because the guest is
single-threaded within its worker. When multiple TIDs run in separate workers
(threading), each worker gets its own buffer.

This replaces the bespoke `stdin` `SharedArrayBuffer` with a generic
syscall-bridge protocol; `stdin` becomes one opcode among many.

On the main thread there is no bridge. `WASIX.start(...)` is still async
— it awaits module fetch and instantiation — but once the guest is
running, every provider call is invoked synchronously. Host picks the mode
up front: `await WASIX.start(...)` for runs where every provider is sync,
or `new WASIXWorkerHost(...)` for runs where any provider may return a
Promise. The types enforce the split — an async-capable provider passed to
`WASIX(...)` is a type error.

## Thread / memory model

Threaded WASIX binaries expect:

- A `wasi_thread_start(tid: i32, startArg: i32) -> ()` export on the module.
- The module imports its memory (`env.memory`) rather than exporting it, and
  that memory is declared `shared: true`.

The runtime's responsibility:

- Construct (or accept from the host) a
  `WebAssembly.Memory({ initial, maximum, shared: true })`.
- Instantiate the main module against that memory.
- On `thread_spawn(startArg)`, call `ThreadsProvider.spawn(startArg)` for a TID.

The _semantics_ of running the new thread are the provider's problem:

- A real-worker provider instantiates a new worker, loads the same WASM module
  against the same shared `Memory`, and calls `wasi_thread_start(tid, startArg)`.
- A cooperative provider maintains a run queue on one worker and schedules
  `wasi_thread_start` invocations cooperatively.
- A mock provider returns a canned TID and never actually runs anything.

The runtime ships a small optional helper, `lib/wasix/thread-start.ts`, that
providers can use if they want the "real worker" path — handles memory
import wiring, `wasi_thread_start` invocation, and exit reporting. Providers
that model threads differently never touch it.

### Memory: auto-detect at load time

WASIX binaries differ in whether they import or export memory. The runtime
inspects the compiled module's imports before instantiation:

- `env.memory` present in imports → runtime constructs a
  `WebAssembly.Memory({ initial, maximum, shared })` matching the declared
  limits and passes it in. `shared` follows the import's shared flag.
- Otherwise → runtime lets the module export its memory and reads it from
  `instance.exports.memory` after instantiation.

A host can override auto-detection by passing `WASIXContextOptions.memory`
(e.g. to reuse a shared `WebAssembly.Memory` across sibling workers in a
threaded configuration). If supplied, it must satisfy whichever mode the
module expects.

### Sequencing

The auto-detect path lands ahead of the threads / futex provider work
because every wasix-libc binary imports `env.memory` (declared `shared`)
regardless of whether the test exercises threads. wasix-libc is built with
`-pthread -mthread-model posix -matomics -mbulk-memory` for the whole
sysroot, so a strictly single-threaded filesystem test still rejects at
`WebAssembly.instantiate` until the runtime supplies a matching shared
`WebAssembly.Memory`. Wiring the import surface is therefore a prerequisite
for any wasmer-suite coverage — including the FS tests served by Slice 3 —
and ships in a small carve-out (Slice 3.5) that does not introduce the
threads provider, the futex provider, or the worker-host bridge. Those
remain in their own slices and consume the same auto-detected memory
when they land.

## Determinism

With `clock` and `random` as providers, a host can pin either or both for
reproducibility:

```ts
const wasix = new WASIX({
  clock: new FixedClockProvider(0n), // epoch 0, monotonic 0
  random: new SeededRandomProvider(42), // seeded PRNG
  // …
});
```

No provider supplied → runtime falls back to `Date.now()` and
`crypto.getRandomValues()` — identical to today's `WASI` defaults.

## Validation

Correctness bar: the upstream WASIX C suite at `wasmer/tests/wasix`
(vendored at the SHA pinned in `tests/wasix-suite.constants.ts` — 42
test directories at the current pin).

### Validation contract

The harness replicates what upstream's `test.sh` + per-test `run.sh`
actually assert — verified by audit, because exit-code-only checking is
provably insufficient (`closing-pre-opened-dirs` passed vacuously on
exit code alone while printing an error the upstream diff would catch):

- **Build parity.** Tests build exactly as upstream does: C tests with
  `wasixcc -sWASM_EXCEPTIONS=false` + per-test `.flags`, C++ tests with
  `wasix++`. (`tests/build-wasix-suite.ts`.)
- **Every run line.** Each `$WASMER_RUN main.wasm …` line in `run.sh`
  becomes one invocation (multi-invocation tests: `udp` ×4, `vfork` ×9,
  …), with `--volume` mounts pre-seeded and filesystem state shared
  across invocations within a test, mirroring the host mount.
- **Exit codes obey `set -e`.** Scripts with `set -e` require exit 0
  from every invocation (minus upstream's own `|| true` markers).
  Scripts without it ignore guest exit codes — `exception` exits 42 by
  design — and validate via the stdout diff.
- **Stdout diffs.** The `printf "…" | diff -u output -` pattern in
  run.sh becomes a byte-equality assertion on captured stdout.

### Suite partition — the denominator stays visible

Every vendored test directory is classified in exactly one of:

- `WASIX_INCLUDE_DIRS` — built and executed (38 of 42 today).
- `WASIX_BUILD_EXCLUDES` — not built, with a structured reason
  (currently only the 4 `dl-*` dynamic-linking tests, which need a
  multi-artifact `.so` build and runtime dynamic linking).

`tests/wasix-suite-consistency.spec.ts` enforces the partition, that
every runtime-skip entry refers to a built test, and that the lists stay
alphabetised. A wasmer SHA bump that adds upstream tests fails CI until
the new tests are classified — coverage can't silently shrink.

Runtime skips use `test.fail(...)`, not `fixme`: skipped tests still
execute, so the moment a capability lands, stale skip entries show up as
"passed unexpectedly" in the report. (This mechanism found
`mount-tmp-locally` passing the same day it was wired.)

### Toolchain

`wasix-org/wasixcc` v0.4.3 (the latest release, pinned in CI and in
`tests/install-wasix-tools.sh`, which installs it locally on
macOS/Linux via the release binaries) builds **everything in the
vendored suite except the `dl-*` family** when invoked with upstream's
flags. The earlier belief that fork/pthread/dlopen tests "cannot link"
was wrong — it was an artifact of our build harness not using
`-sWASM_EXCEPTIONS=false` / `wasix++`; all fork-family tests now build
and run (and fail as classified, awaiting Asyncify — see the skip map).

### Coverage gaps in the upstream suite

The vendored C suite has **no tests at all** for threads
(`thread_spawn` / pthreads), sockets beyond `udp` + `fd-close`, TTY,
futex, or poll/epoll. The provider slices for those surfaces therefore
cannot lean on the wasmer suite for validation. Per-slice validation
comes from purpose-built fixtures instead:

- Hand-written WAT/C fixtures under `programs/` (the existing
  clock/random/errno pattern), compiled with the same pinned wasixcc.
- Candidate supplementary source:
  [`wasmerio/wasix-integration-tests`](https://github.com/wasmerio/wasix-integration-tests)
  (Rust, snapshot-validated) — evaluate per slice whether vendoring
  selected tests is worth the Rust toolchain dependency.

Each future slice that adds a provider MUST land with its fixtures in
the same PR; the wasmer suite alone is not an acceptance gate for
threads/sockets/TTY/futex work.

This shapes the design in two concrete ways.

### Simulation providers ship with the package

The runtime has no semantics of its own. To run the upstream suite end-to-end,
the package ships a set of **simulation** providers — in-process, sandboxed,
self-contained. They are not "reference implementations" of real Linux-style
semantics; they model just enough behaviour to satisfy the test harness
without ever touching a real socket, real process, or real OS thread.

```
lib/wasix/providers/
├── cooperative-threads.ts   cooperative scheduler, single worker, no preemption
├── simulated-futex.ts       in-memory wait queues keyed by address
├── loopback-sockets.ts      in-process TCP/UDP fabric; connects speak to peers
│                            registered in the same WASIX instance
├── passthrough-tty.ts       reflects WASIXContext.isTTY + canned winsize
├── self-signal.ts           signal_register + in-process dispatch
├── in-process-proc.ts       proc_spawn / proc_exec launch new WASIX instances
│                            in the same JS realm; proc_join awaits their result
├── system-clock.ts          Date.now() / performance.now() — overridable
└── system-random.ts         crypto.getRandomValues() — overridable
```

Every file above is importable on its own. Nothing is wired into
`WASIXContext` by default — the host picks providers explicitly. The
integration suite runner configures a `WASIX` instance from this set; a unit
test can swap in a `FixedClockProvider`, a `SeededRandomProvider`, or its own
fakes.

This is the design point: _simulations are enough to pass the suite._ The
tests exercise API shape and errno behaviour, not real-world networking or
real OS process semantics. A host that needs real behaviour plugs in its own
providers (e.g. a `node-sockets.ts` backed by `node:net`) — but Runno doesn't
ship those, because Runno is a sandbox.

### Known-skipped tests

**End-state skip rule: a test is skipped iff it requires Asyncify (or
JSPI) instrumentation on the guest module, or a drive feature
deliberately deferred to the
[drive feature workstream](#drive-feature-workstream).** If a
simulation provider can be written to make a test pass, we write one.

The Asyncify category covers:

- `proc_fork` asserting on post-fork guest execution (all fork-family
  tests: `fork`, `pipes`, `shared-fd`, `share-tmp-*`, `proc-exec*`,
  `cloexec`, `signal`).
- Asynchronous signal pre-emption — a signal delivered from outside the
  guest's current call, pre-empting running code mid-frame.
- Userspace context switching (`context_create` / `context_switch`,
  the `context-switching` test).

(Cross-frame `setjmp`/`longjmp` left this category — see the empirical
amendment under Non-goals.)

The drive-feature category covers mmap/msync file mappings, symlinks,
`mount`, and stdio/fd-table close semantics — each with a matching
entry in the workstream.

**Interim rule while slices land:** tests blocked only on a provider
that hasn't shipped yet carry a `requires-provider-*` token
(`popen`/`posix_spawn`/`vfork` → proc, `udp`/`fd-close` → sockets).
These flip to passing as their slice lands — enforced automatically
because skips run as `test.fail` and report "passed unexpectedly".

The skip map lives in `tests/wasix-suite.skip.ts`; every entry names a
token from the fixed vocabulary plus a one-line justification.

### Why those tests can't be passed by providers alone

Take `proc_fork` as the canonical case. The syscall requires:

1. The **parent** resumes after the fork() import call with `pid = <child>`.
2. A **child** — a separate WASM instance — resumes after the same fork() call
   with `pid = 0`, with a clone of the parent's memory, and with every local
   variable in every active frame preserved.

(1) is free — it's a normal import return. (2) is the blocker.

When a provider is handling an import, the guest is paused inside that call.
Via `WebAssembly.Instance` the provider can see:

- `memory.buffer` — readable, cloneable.
- Exports (globals, tables, functions) — readable, callable from the beginning.

It cannot see the guest's **call stack** or **program counter**. WebAssembly
does not expose these to JS. Engines implement the stack differently —
V8 uses the native C stack, Wasmtime its own, SpiderMonkey different again —
and the spec deliberately leaves it opaque so engines can optimise freely.
There is no API for it, public or private.

Entering a WASM instance from JS means calling an export from its start.
There is no "resume at frame N, instruction M." So a provider can clone
memory but cannot tell the child instance _where to begin_.

The same limitation hits two related syscalls:

- **Async signal delivery.** "Pause the running guest, jump to the registered
  handler, then resume where we were" has the same resume-at-frame need.
  Self-raised signals that happen at controlled yield points are fine;
  signals delivered from outside the guest's current call are not.
- **Userspace context switching.** `context_create` / `context_switch`
  swap between guest execution contexts — reifying and restoring the
  stack is the whole operation. Same blocker.

(Cross-frame `setjmp`/`longjmp` used to sit here too, but wasm-exceptions
builds implement it inside the guest via wasm EH — no external stack
manipulation needed — and those builds pass in browsers today.)

In all three, the root cause is identical: **WASM execution state is not
reifiable from JS**.

Both workarounds described in [Future: Asyncify opt-in](#future-asyncify-opt-in)
operate below the provider layer. Asyncify moves the stack _into_ guest
memory where JS can see it; JSPI adds a first-class pause/resume primitive
at the engine. Neither is something a provider can do at call time — which
is why v1 ships with these tests skipped rather than working around them.

### Future: Asyncify opt-in

The fork/pre-emption limitation is not permanent. Two paths lift it without
changing the provider API:

1. **Asyncify opt-in.** Users asyncify their WASIX binary at build time (or
   Runno runs the Binaryen pass at load time behind a flag). Providers gain
   a pause/resume hook that uses Asyncify's save/restore to unwind and
   re-enter the guest. `proc_fork` becomes a provider-implementable syscall.
2. **JS Promise Integration (JSPI).** Once JSPI is widely available, it
   supplies the same pause/resume capability without module rewriting.

Either is additive: a new optional flag on `WASIXContextOptions`, a new
provider capability bit. Out of scope for v1.

### CI

One provider configuration — the simulation set from
[Simulation providers ship with the package](#simulation-providers-ship-with-the-package) —
runs in CI under Playwright against chromium, firefox, and webkit (the
dev server sets COOP/COEP so shared-memory imports instantiate). There
is **no Node.js runtime test target today**; `@runno/wasi` is
browser-focused and a Node harness is possible future work, not a
current claim. The suite runs identically in all three browsers minus
the skip map.

### Testing layers

Validation is spread across five Playwright spec layers, all runnable
locally (`npm run wasix:install-tools`, `npm run test:prepare:wasix-suite`,
`npx playwright test`):

1. **Unit** (`wasix-unit.spec.ts`, Node-side, no browser) — the wasm
   import-section parser (`lib/wasix/module-imports.ts`), memory/table
   override validation, cwd path resolution (`lib/wasix/path-utils.ts`).
2. **Error model** (`wasix-error-model.spec.ts`) — a WAT probe
   (`wasix-errno.wat`) exits with `random_get`'s errno, proving
   `WASIXError → its errno`, `any other throw → EIO`, and that nothing
   propagates across the WASM boundary as a JS exception.
3. **Smoke + determinism** (`wasix-smoke`, `wasix-clock-random`,
   `wasix-fs-provider` specs) — hand-rolled WAT guests incl. the
   golden-byte determinism check.
4. **preview1-under-WASIX** (`wasix-preview1-corpus.spec.ts`) — the
   full caspervonb corpus (core/libc/libstd) run through `WASIX.start`,
   covering the overridden preview1 delegation surface and the
   export-memory auto-detect path. Three documented expected-failures:
   tests asserting `errno == ENOTCAPABLE` where WASIX deliberately
   speaks POSIX (`ENOENT`).
5. **Upstream wasix suite** (`wasix-suite.spec.ts` +
   `wasix-suite-consistency.spec.ts`) — as described above.

## Drive feature workstream

Skip-map triage surfaced drive-level capabilities (not provider slots)
that block vendored tests. Each is deliberate deferred work with an
owner test set, so the "skipped iff Asyncify" end-state rule stays
honest:

- **mmap / msync file-backed mappings** — 8 tests (`msync-*`,
  `munmap-sync-*`, `read-after-munmap`). Needs the drive to model
  memory-mapped file ranges and write-back.
- **Symlinks** — `symlink-open-read-write`. WASIDrive has no link
  representation. (Also needs harness-side pre-seed of `target.txt`
  and a host-side post-assert; noted in the skip entry.)
- **mount / multiple preopen roots** — `fs-mount`. Runno currently has
  a single preopen root plus `/home`.
- **fd-table extraction** — `dup` (fd_renumber/fd_dup2), stdio close
  semantics (`closing-pre-opened-dirs` expects `fclose(stdout)` to make
  later writes vanish; stdio currently routes to host callbacks and
  never closes). Planned as Slice 9.

## Slice roadmap

Landed:

1. Skeleton + hello-world smoke (`WASIX`, `WASIXContext`, wasix_32v1
   stub surface).
2. Clock + Random providers (+ `FixedClockProvider`,
   `SeededRandomProvider`, golden-byte determinism test).
3. Filesystem provider (`WASIDriveFileSystemProvider`) + wasmer suite
   harness.
   3.5. Module-instantiation surface (env.memory/env.\_\_indirect_function_table
   auto-detect, COOP/COEP, v2 stubs) + validation hardening (stdout-diff
   contract, suite partition + consistency spec, preview1-corpus-under-WASIX,
   unit + error-model specs).

Upcoming (each lands with its own fixtures per
[Coverage gaps](#coverage-gaps-in-the-upstream-suite)):

4. Sockets provider (loopback simulation) — unskips `udp`, `fd-close`;
   needs own fixtures for TCP/accept paths.
5. Threads provider (cooperative + real-worker helper) + shared-memory
   plumbing — no upstream tests exist; fixtures required.
6. Futex provider — fixtures required.
7. Proc provider (spawn/exec/join simulation) — unskips `popen`,
   `posix_spawn`, `vfork`.
8. Signals provider (self-raise at yield points) — fixtures required.
9. fd-table extraction (fd_renumber/dup2/fdflags, stdio close) —
   unskips `dup`-class behaviour and `closing-pre-opened-dirs`.
10. TTY provider + `WASIXWorkerHost` + async syscall bridge.

Drive features (mmap, symlinks, mount) slot in independently of the
provider slices; sequence by demand.

## Error model

- Provider slot empty for a given syscall → return `Result.ENOSYS` without
  ever invoking a provider.
- Provider throws a `WASIXError` subclass → its `.result` is returned as the
  syscall's errno.
- Provider throws anything else → treated as a runtime error, logged via the
  `debug` hook, syscall returns `Result.EIO`. The thrown value is **not**
  propagated across the WASM boundary — the guest sees a normal errno, not a
  thrown JS exception.
- `proc_exit` and uncaught `WebAssembly.RuntimeError` keep their current
  `WASI` behaviour (exit code, 134 respectively).

## Follow-up: refactor WASI to the provider model

The two-tier provider shape applies cleanly to the existing preview1 +
unstable implementation. Recommended as a follow-up PR once WASIX lands
and validates the pattern in anger.

What moves:

- `WASIContext`'s `stdin` / `stdout` / `stderr` callbacks → `ConsoleTTYProvider`.
- `WASIDrive` (currently internal) → `FileSystemProvider`, promoted to
  a public ergonomic provider. Internal consumers switch to calling through
  the provider.
- Hard-coded `Date.now()` / `crypto.getRandomValues()` inside `WASI` →
  `ClockProvider` / `RandomProvider` with the same defaults. Determinism
  knob comes along for free.
- preview1's `sock_*` family (`send`, `recv`, `shutdown` on accepted fds) →
  served by the same `SocketsProvider`, so `HTTPProvider` works for WASI
  too.

Why it's worth doing:

- One extension-point model across preview1, unstable, and wasix_32v1.
  Fewer concepts for hosts to learn.
- `HTTPProvider`, `FileSystemProvider`, `ConsoleTTYProvider`, and the
  determinism knobs become available to existing Runno demos without
  opting into WASIX.
- The `WASI` and `WASIX` classes stop being asymmetric siblings — both
  sit on the same provider substrate, only the import surface differs.

Backward compatibility: the current `WASIContext` surface stays as a
convenience shim that constructs the equivalent providers internally. No
host code breaks; hosts that want the new model opt in explicitly.

Sequencing: WASIX first because it's what forces the provider shape. Once
WASIX ships and the provider set is stable, the refactor mirrors the same
substrate backward into WASI in its own PR.

## Open questions

- Exact ABI values and struct layouts for the not-yet-wired WASIX
  syscalls (sockets, threads, futex, proc, signals, TTY) — pinned per
  slice against the WASIX C headers into `lib/wasix/wasix-32v1.ts`.
  (FS/clock/random/cwd are pinned and validated.)
- ~~Exact skip list.~~ Enumerated: see `tests/wasix-suite.skip.ts`
  (runtime skips) and `WASIX_BUILD_EXCLUDES` in
  `tests/wasix-suite.constants.ts` (build excludes); both are enforced
  by the consistency spec.
- Fixture format for the thread/socket/TTY slices — WAT vs C-on-wasixcc
  per capability; decide in each slice PR (see
  [Coverage gaps](#coverage-gaps-in-the-upstream-suite)).
- Whether the `wasix_32v1` v2 fd-flags surface (`path_open2` fdflags2
  bits, `fd_fdflags_*`) gets semantics in Slice 9 or stays stubbed until
  a binary demands it.
