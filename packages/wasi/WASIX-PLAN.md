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
  using the simulation providers shipped with the package. See
  [Validation](#validation).

Every WASIX syscall has a provider slot. Unwired slots return `ENOSYS`.

**Non-goals.**

- Tests requiring Asyncify (or JSPI) instrumentation on the guest module —
  principally `proc_fork` asserting on post-fork execution, asynchronously
  delivered signals that pre-empt running code, and cross-frame
  `setjmp`/`longjmp` across a JS-imported call. These need the guest's call
  stack and program counter reified from outside, which WebAssembly does not
  expose to JS. A provider can't supply that at call time. Tracked as
  known-skipped. See [Future: Asyncify opt-in](#future-asyncify-opt-in) for
  the path to lifting this.
- `proc_exec` and `proc_spawn` are **not** in this category — they start a
  fresh instance, which a provider can do. Expected to pass.
- Real socket / process / thread implementations baked into the runtime *or*
  shipped as Runno providers. Runno is a sandbox; its providers are
  simulations. A host that wants real-world semantics wires its own
  providers — Runno does not ship them.
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

// fork / spawn / exec receive plain-data requests — opaque JS objects
// containing the argv / env / fd table / memory snapshot the provider needs.
// The provider never sees a live `WASIX` instance or the WebAssembly.Memory
// directly; it decides on its own what "starting a new process" means.

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

This is the design point: *simulations are enough to pass the suite.* The
tests exercise API shape and errno behaviour, not real-world networking or
real OS process semantics. A host that needs real behaviour plugs in its own
providers (e.g. a `node-sockets.ts` backed by `node:net`) — but Runno doesn't
ship those, because Runno is a sandbox.

### Known-skipped tests

**Skip rule: a test is skipped iff it requires Asyncify (or JSPI)
instrumentation on the guest module.** No other reason justifies a skip. If
a simulation provider can be written to make a test pass, we write one.

In practice that rule carves out exactly three categories:

- `proc_fork` asserting on post-fork guest execution.
- Asynchronous signal pre-emption — a signal delivered from outside the
  guest's current call, pre-empting running code mid-frame.
- Cross-frame `setjmp`/`longjmp` across a JS-imported call.

See [the reasoning below](#why-those-tests-cant-be-passed-by-providers-alone)
for why these three need Asyncify. Everything else — `proc_exec`,
`proc_spawn`, threads, futex, sockets, TTY, self-raised signals at yield
points, clocks, random — is implementable with simulation providers and
expected to pass.

The test harness carries an explicit skip list with a one-line
"requires-Asyncify" justification per entry.

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

Both workarounds described in [Future: Asyncify opt-in](#future-asyncify-opt-in)
operate below the provider layer. Asyncify moves the stack *into* guest
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
runs in CI against both Node and browser (Playwright, COOP/COEP). Because
the sockets provider is loopback-only and all processes live in the same JS
realm, there is nothing environment-specific to branch on. Both runs execute
the same suite minus the Asyncify-only skip list.

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

- Exact ABI values and struct layouts for each WASIX syscall — pinned during
  implementation against the WASIX C headers into `lib/wasix/wasix-32v1.ts`.
- Exact skip list from `wasix-integration-tests`. Enumerate once the runtime
  boots the suite end-to-end and apply the "requires Asyncify" rule per test.
