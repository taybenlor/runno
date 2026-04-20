# WASIX support — technical design

*Status: design phase. Describes the target architecture; revise as decisions land.*

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
- **Pass the upstream WASIX integration test suite
  ([`wasmerio/wasix-integration-tests`](https://github.com/wasmerio/wasix-integration-tests))**
  under a reference provider configuration shipped with the package. See
  [Validation](#validation).

Every WASIX syscall has a provider slot. Unwired slots return `ENOSYS`.

**Non-goals.**

- Tests requiring in-place resumption of WASM execution — principally
  `proc_fork`, asynchronous (pre-empting) signal delivery, and cross-frame
  `setjmp`/`longjmp`. These need the guest's call stack and program counter
  to be reified from outside, which WebAssembly does not expose to JS.
  Wasmer works around it with whole-module Asyncify instrumentation plus its
  journaling runtime; a provider can't do either at call time. Tests that
  depend on resume-after-fork are tracked as known-skipped. See
  [Future: pause/resume support](#future-pauseresume-support) for the path
  to lifting this.
- `proc_exec` and `proc_spawn` are **not** in this category — they start a
  fresh instance, which a provider can do. Expected to pass.
- Real socket / fork / exec implementations baked into the runtime. Those live
  in providers — some of which Runno ships (enough to pass the suite), some of
  which are the host's.
- `wasix_64v1` (Memory64 / wasm64). No existing toolchain output drives demand;
  the `wasix-libc` chain targets wasm32 in practice. Deferred — the handler
  code would mostly overlap with `wasix_32v1`, so picking it up later is cheap.

## Public surface

New root exports from `@runno/wasi`:

```ts
export { WASIX, WASIXContext, WASIXWorkerHost } from "./wasix/...";
export type {
  ClockProvider, RandomProvider,
  TTYProvider, ThreadsProvider, FutexProvider,
  SignalsProvider, SocketsProvider, ProcProvider,
} from "./wasix/providers.js";
```

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

## Context & providers

```ts
type WASIXContextOptions = {
  // File / process basics — same semantics as WASIContext
  fs: WASIFS;
  args: string[];
  env: Record<string, string>;
  stdin: (maxByteLength: number) => string | null | Promise<string | null>;
  stdout: (out: string) => void | Promise<void>;
  stderr: (err: string) => void | Promise<void>;
  isTTY: boolean;
  debug?: DebugFn;

  // Providers — all optional, all async-capable
  clock?:   ClockProvider;    // clock_time_get, clock_res_get
  random?:  RandomProvider;   // random_get
  tty?:     TTYProvider;      // tty_get, tty_set
  threads?: ThreadsProvider;  // thread_spawn/join/exit/sleep/id/parallelism/signal
  futex?:   FutexProvider;    // futex_wait, futex_wake(_all)
  signals?: SignalsProvider;  // signal_register, proc_raise_interval
  sockets?: SocketsProvider;  // WASIX socket surface (TCP/UDP/resolve)
  proc?:    ProcProvider;     // proc_id, proc_fork/spawn/exec/join, proc_parent
};
```

All provider methods may be sync or async. Every method uses JS-native shapes
— `Uint8Array`, `bigint`, `Promise<T>`, plain objects for structured types
like `SockAddr`. **Raw pointers never leave the `WASIX` class.**

Example interface shapes (final forms pinned during implementation):

```ts
interface ClockProvider {
  now(id: ClockId): bigint | Promise<bigint>;        // nanoseconds
  resolution(id: ClockId): bigint | Promise<bigint>;
}

interface RandomProvider {
  fill(buf: Uint8Array): void | Promise<void>;
}

interface ThreadsProvider {
  spawn(startArg: number): number | Promise<number>;    // tid
  join(tid: number): number | Promise<number>;          // exit code
  exit(code: number): void;
  sleep(durationNs: bigint): void | Promise<void>;
  id(): number;
  parallelism(): number;
  signal(tid: number, signo: number): Result | Promise<Result>;
}

interface FutexProvider {
  wait(addr: number, expected: number, timeoutNs: bigint | null)
    : number | Promise<number>;
  wake(addr: number, count: number): number | Promise<number>;
}

interface SocketsProvider {
  open(af: number, type: number, proto: number): number | Promise<number>;
  bind(fd: number, addr: SockAddr): Result | Promise<Result>;
  connect(fd: number, addr: SockAddr): Result | Promise<Result>;
  listen(fd: number, backlog: number): Result | Promise<Result>;
  accept(fd: number): number | Promise<number>;
  send(fd: number, bufs: Uint8Array[], flags: number)
    : number | Promise<number>;
  recv(fd: number, bufs: Uint8Array[], flags: number)
    : SockRecvResult | Promise<SockRecvResult>;
  shutdown(fd: number, how: number): Result | Promise<Result>;
  addrResolve(host: string, port: number, hints: AddrHints)
    : SockAddr[] | Promise<SockAddr[]>;
  // …getsockopt/setsockopt, addr_local/peer, status
}

interface ProcProvider {
  id(): number;
  parentId(): number;
  fork(): ProcForkResult | Promise<ProcForkResult>;
  spawn(req: ProcSpawnRequest): number | Promise<number>;
  exec(req: ProcExecRequest): Result | Promise<Result>;
  join(pid: number): ProcExitInfo | Promise<ProcExitInfo>;
}

interface SignalsProvider {
  register(signo: number, handler: number): Result | Promise<Result>;
  raiseInterval(signo: number, intervalNs: bigint): Result | Promise<Result>;
}

interface TTYProvider {
  get(): TTYState | Promise<TTYState>;       // cols, rows, pixel size, echo, line, raw, …
  set(state: TTYState): Result | Promise<Result>;
}
```

## Async syscall bridge

All provider calls can return a Promise. On the main thread this is trivial —
the `WASIX` class awaits before returning to the guest. Inside a
`WASIXWorker`, the WASM guest is synchronous from its own point of view and
needs a way to block until the host-side promise resolves.

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

On the main thread (no worker), there is no bridge: `WASIX.start` is an async
function that awaits provider Promises directly. The public API makes this
explicit — `await WASIX.start(...)` vs `new WASIXWorkerHost(...)`.

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

The *semantics* of running the new thread are the provider's problem:

- A real-worker provider instantiates a new worker, loads the same WASM module
  against the same shared `Memory`, and calls `wasi_thread_start(tid, startArg)`.
- A cooperative provider maintains a run queue on one worker and schedules
  `wasi_thread_start` invocations cooperatively.
- A mock provider returns a canned TID and never actually runs anything.

The runtime ships a small optional helper, `lib/wasix/thread-start.ts`, that
providers can use if they want the "real worker" path — handles memory
import wiring, `wasi_thread_start` invocation, and exit reporting. Providers
that model threads differently never touch it.

## Determinism

With `clock` and `random` as providers, a host can pin either or both for
reproducibility:

```ts
const wasix = new WASIX({
  clock:  new FixedClockProvider(0n),     // epoch 0, monotonic 0
  random: new SeededRandomProvider(42),   // seeded PRNG
  // …
});
```

No provider supplied → runtime falls back to `Date.now()` and
`crypto.getRandomValues()` — identical to today's `WASI` defaults.

## Validation

Correctness bar: [`wasmerio/wasix-integration-tests`](https://github.com/wasmerio/wasix-integration-tests),
the upstream WASIX integration suite.

This shapes the design in two concrete ways.

### Reference providers ship with the package

To run the suite end-to-end, a consuming host needs working threads, futex,
sockets, TTY, signals, clock, and random semantics. The runtime alone cannot
supply those (it's the sandbox — it never does real work). So the package
ships two provider tiers:

```
lib/wasix/providers/
├── reference/      real-world semantics, enough to pass the upstream suite
│   ├── worker-threads.ts        real Worker-backed ThreadsProvider
│   ├── atomics-futex.ts         Atomics.wait/notify on shared memory
│   ├── node-sockets.ts          node:net / node:dgram SocketsProvider (node only)
│   ├── ws-proxy-sockets.ts      WebSocket-proxy SocketsProvider (browser)
│   ├── system-clock.ts          Date.now() / performance.now()
│   ├── web-crypto-random.ts     crypto.getRandomValues()
│   ├── passthrough-tty.ts       reflects WASIXContext.isTTY + reasonable winsize
│   └── self-signal.ts           signal_register + in-process dispatch
└── deterministic/  test-friendly providers
    ├── fixed-clock.ts
    ├── seeded-random.ts
    ├── mock-sockets.ts
    ├── mock-threads.ts
    └── …
```

Both tiers are exported publicly but importing is opt-in — nothing is wired
into `WASIXContext` by default. The integration suite runner configures a
`WASIX` instance with the `reference/` providers; a unit test can use
`deterministic/` providers or its own fakes.

This keeps the "Runno emulates, you simulate" design intact: the runtime has
no semantics; the *reference providers* do, and they're just one possible
host configuration among many.

### Known-skipped tests

A small set of tests depends on resuming WASM execution at a specific frame
from the outside — principally `proc_fork`, asynchronous signal pre-emption,
and cross-frame `setjmp`/`longjmp`. See [the reasoning below](#why-those-tests-cant-be-passed-by-providers-alone)
for why these aren't achievable with a provider alone. The test harness
carries an explicit skip list with a one-line justification per entry. Any
test that *can* be made to pass with sufficiently capable providers —
including `proc_exec`, `proc_spawn`, threads, futex, sockets, and TTY — is
not in this list.

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
memory but cannot tell the child instance *where to begin*.

The same limitation hits two related syscalls:

- **Async signal delivery.** "Pause the running guest, jump to the registered
  handler, then resume where we were" has the same resume-at-frame need.
  Self-raised signals that happen at controlled yield points are fine;
  signals delivered from outside the guest's current call are not.
- **Cross-frame `setjmp`/`longjmp`.** Unwinding from inside a JS-imported
  call back to a target several WASM frames up requires popping the guest
  stack from outside. Same blocker.

In all three, the root cause is identical: **WASM execution state is not
reifiable from JS**.

Both workarounds described in [Future: pause/resume support](#future-pauseresume-support)
operate below the provider layer. Asyncify moves the stack *into* guest
memory where JS can see it; JSPI adds a first-class pause/resume primitive
at the engine. Neither is something a provider can do at call time — which
is why v1 ships with these tests skipped rather than working around them.

### Future: pause/resume support

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

The integration suite runs in CI against both provider configurations:
- Node — `reference/` + `node-sockets`.
- Browser (Playwright, COOP/COEP) — `reference/` + `ws-proxy-sockets` backed
  by a local proxy started for the test run.

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

## Open questions

- Exact ABI layout for each WASIX syscall — pinned during implementation
  against the WASIX C headers.
- `proc_fork` / `proc_spawn` provider shape: does the provider receive an
  opaque snapshot of module state (so it could in principle continue execution
  elsewhere) or just a notification with args? Leaning opaque-snapshot to keep
  options open, but the shape needs worked examples before we commit.
- Module init order when `env.memory` is host-supplied vs module-exported.
  WASIX binaries vary; we need a clean story for both.
- Do we expose the syscall-bridge opcodes publicly, so third parties can
  implement providers out-of-process (e.g. over a websocket to a remote host)?
  Attractive for future work; leave closed initially.
- Exact skip list from `wasix-integration-tests`. Enumerate once the runtime
  boots the suite end-to-end; revisit per test rather than guessing ahead.
