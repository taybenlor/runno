# WASIX support — plan

*Status: in progress. Living document — revise as decisions land.*

## Goal

Support WASIX binaries in `@runno/wasi` using Runno's existing sandboxing
philosophy: the runtime provides the marshalling between WASM memory and
JavaScript; the host supplies the semantics via pluggable providers.

> Runno emulates. You simulate.

The runtime never performs a real syscall. For every WASIX capability, the host
decides what "the world" looks like — a real `Worker`, a scripted scheduler, a
recorded trace, a network simulator, `/dev/null`. Runno doesn't care.

## Decisions

- **Separate root export `WASIX`.** The existing `WASI` class and its
  preview1/unstable behaviour are untouched. `WASIX` is a new class with its own
  context, worker host, and import namespaces. This leaves room for future
  `WASIPreview2` / `WASIPreview3` classes the same way.
- **Async-first providers.** Every provider method may return a Promise. The
  WASI ↔ WASM bridge handles async the same way the current `stdin` path
  handles blocking: main thread resolves, worker blocks on `SharedArrayBuffer`
  + `Atomics.wait`. Sync returns remain valid.
- **Clock and Random become providers.** Available from day one on
  `WASIXContext`. Enables deterministic / reproducible execution. Potential
  backport to `WASIContext` is out of scope for this work.
- **ENOSYS by default.** Any WASIX syscall whose provider slot is empty
  returns `ENOSYS`. A WASIX binary boots as long as it only uses calls whose
  providers are wired up.

## Public surface

```ts
// New root exports from @runno/wasi
export { WASIX, WASIXContext, WASIXWorkerHost } from "./wasix/...";
```

Import namespaces served by `WASIX`:

- `wasix_32v1` (32-bit)
- `wasix_64v1` (memory64 binaries)
- `wasi_snapshot_preview1` — serviced by the existing preview1 implementation
  (reused, not duplicated). WASIX binaries typically import both.
- `wasi_unstable` — same reason.

Existing `WASI` class and exports are unchanged.

## Provider catalog

All provider methods may be sync or async (return `T` or `Promise<T>`).

```ts
type WASIXContextOptions = {
  // Same surface as WASIContext: fs, args, env, stdin, stdout, stderr, debug, isTTY
  // plus:

  clock?:   ClockProvider;    // clock_time_get / clock_res_get — overridable for determinism
  random?:  RandomProvider;   // random_get — overridable for reproducibility

  tty?:     TTYProvider;      // tty_get, tty_set
  threads?: ThreadsProvider;  // thread_spawn/join/exit/sleep/id/parallelism/signal
  futex?:   FutexProvider;    // futex_wait, futex_wake(_all)
  signals?: SignalsProvider;  // signal_register, proc_raise_interval
  sockets?: SocketsProvider;  // full WASIX socket surface (TCP/UDP/resolve)
  proc?:    ProcProvider;     // proc_id, proc_fork/spawn/exec/join, proc_parent
};
```

Interface sketches (finalised in PR 2):

```ts
interface ClockProvider {
  now(id: ClockId): bigint | Promise<bigint>;        // nanoseconds since epoch / monotonic start
  resolution(id: ClockId): bigint | Promise<bigint>;
}

interface RandomProvider {
  fill(buf: Uint8Array): void | Promise<void>;
}

interface ThreadsProvider {
  spawn(startArg: number): number | Promise<number>;
  join(tid: number): number | Promise<number>;
  exit(code: number): void;
  sleep(durationNs: bigint): void | Promise<void>;
  id(): number;
  parallelism(): number;
}

interface SocketsProvider {
  open(af: number, type: number, proto: number): number | Promise<number>;
  bind(fd: number, addr: SockAddr): Result | Promise<Result>;
  connect(fd: number, addr: SockAddr): Result | Promise<Result>;
  send(fd: number, bufs: Uint8Array[], flags: number): number | Promise<number>;
  recv(fd: number, bufs: Uint8Array[], flags: number): number | Promise<number>;
  // …etc, 1:1 with WASIX socket calls
}
```

Each provider method is expressed in JS-native shapes (`Uint8Array`, `bigint`,
`Promise`) — never raw pointers. Memory marshalling lives in the `WASIX` class.

## Delivery plan

### PR 1 — WASIX scaffolding

- New subtree `lib/wasix/`:
  - `wasix.ts` — `WASIX` class
  - `wasix-context.ts` — `WASIXContext` + provider types
  - `wasix-abi.ts` — constants and type codes (1:1 with the WASIX C headers)
  - `wasix-worker.ts` / `wasix-host.ts` — worker harness
- New root exports; existing `WASI` untouched.
- Register `wasix_32v1` + `wasix_64v1` import namespaces. Also register
  `wasi_snapshot_preview1` and `wasi_unstable` — service these via the existing
  preview1 implementation (reuse, don't duplicate).
- Implement the WASIX calls that need no provider: `chdir`, `getcwd`,
  `env_set` / `env_unset`, `fd_dup` / `fd_dup2` / `fd_pipe` / `fd_event`
  (drive-level).
- All other WASIX calls: `ENOSYS` passthroughs.
- Basic test binary that boots and exits cleanly.

### PR 2 — providers + async marshalling

- Define and export every `*Provider` interface (including `ClockProvider` and
  `RandomProvider`).
- Generalise the existing `stdin` blocking pattern into a single
  "await host response via `SharedArrayBuffer` + `Atomics.wait`" helper.
  Every provider call routes through it.
- For every WASIX syscall with a provider: read WASM memory → dispatch to
  provider → await if Promise → write result back. No policy in the WASI layer.
- Reference providers under `lib/wasix/providers/`:
  - `FixedClockProvider`, `SeededRandomProvider` — deterministic defaults.
  - `AtomicsFutexProvider` — if the host supplies shared memory.
  - `MockSocketsProvider`, `MockThreadsProvider` — scripted, for tests.
- TypeDoc for every interface.

### PR 3 — examples, docs, coverage

- Example WASIX programs exercising each provider slot (vendored binaries or
  compiled via `wasix-libc`).
- README: *"Runno emulates. You simulate."* explaining the pattern.
- Worked example: threaded-Rust binary running against a cooperative
  `ThreadsProvider` that schedules tasks round-robin on a single worker —
  proving threads can be fully host-simulated without real `Worker`s.

## Out of scope

Nothing in WASIX is out of scope. Every syscall has a provider slot; unwired
slots return `ENOSYS`. Hosts plug in as much or as little semantics as they
need.

## Open questions

- Exact interface shapes — pinned in PR 2.
- Do we backport `ClockProvider` / `RandomProvider` to the existing `WASI`
  class? Separate minor-version bump; non-blocking here.
- Do we expose a `WASIPreview2` path now, or wait until a real 0.2 binary
  surfaces? Leaning wait.
- `proc_fork` / `proc_spawn` semantics: a host that wants to simulate these
  needs some "pause and hand over state" concept. The provider probably
  receives an opaque snapshot object and returns a child handle. Revisit
  in PR 2 or later.
