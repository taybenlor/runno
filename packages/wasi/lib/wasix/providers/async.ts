// Async-capable provider variants, accepted by WASIXWorkerHost (future slice).
//
// A single utility type lifts any raw provider into an async-capable variant
// by making every method optionally return a Promise. The inner WASIX class
// only ever sees sync providers; WASIXWorkerHost converts async providers to
// sync via the syscall bridge.

import {
  ClockProvider,
  FutexProvider,
  ProcProvider,
  RandomProvider,
  SignalsProvider,
  SocketsProvider,
  ThreadsProvider,
  TTYProvider,
} from "../providers.js";

export type AsyncCapable<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R | Promise<R>
    : T[K];
};

export type AsyncClockProvider = AsyncCapable<ClockProvider>;
export type AsyncRandomProvider = AsyncCapable<RandomProvider>;
export type AsyncTTYProvider = AsyncCapable<TTYProvider>;
export type AsyncThreadsProvider = AsyncCapable<ThreadsProvider>;
export type AsyncFutexProvider = AsyncCapable<FutexProvider>;
export type AsyncSignalsProvider = AsyncCapable<SignalsProvider>;
export type AsyncSocketsProvider = AsyncCapable<SocketsProvider>;
export type AsyncProcProvider = AsyncCapable<ProcProvider>;
