// Raw synchronous provider interfaces for WASIX syscall slots.
// Every method is synchronous — no Promise return types.
// Async-capable variants (for WASIXWorkerHost) live in providers/async.ts.
//
// Raw pointers never leave the WASIX class; providers receive and return
// JS-native shapes (Uint8Array, bigint, plain objects).

import { ClockId, Result } from "./wasix-32v1.js";

// ─── Supporting shapes ────────────────────────────────────────────────────────

export type SockAddr =
  | { family: "inet4"; address: string; port: number }
  | { family: "inet6"; address: string; port: number }
  | { family: "unix"; path: string };

export type AddrHints = {
  family?: number;
  type?: number;
  protocol?: number;
  flags?: number;
};

export type SockRecvResult = {
  bytesRead: number;
  flags: number;
};

export type TTYState = {
  cols: number;
  rows: number;
  pixelWidth: number;
  pixelHeight: number;
  echo: boolean;
  lineBuffered: boolean;
  raw: boolean;
};

export type ProcForkResult = {
  pid: number;
  isChild: boolean;
};

export type ProcSpawnRequest = {
  path: string;
  args: string[];
  env: Record<string, string>;
};

export type ProcExecRequest = {
  path: string;
  args: string[];
  env: Record<string, string>;
};

export type ProcExitInfo = {
  exitCode: number;
};

// ─── Provider interfaces ──────────────────────────────────────────────────────

export interface ClockProvider {
  now(id: ClockId): bigint;
  resolution(id: ClockId): bigint;
}

export interface RandomProvider {
  fill(buf: Uint8Array): void;
}

export interface TTYProvider {
  get(): TTYState;
  set(state: TTYState): Result;
}

export interface ThreadsProvider {
  spawn(startArg: number): number;
  join(tid: number): number;
  exit(code: number): void;
  sleep(durationNs: bigint): void;
  id(): number;
  parallelism(): number;
  signal(tid: number, signo: number): Result;
}

export interface FutexProvider {
  wait(addr: number, expected: number, timeoutNs: bigint | null): number;
  wake(addr: number, count: number): number;
}

export interface SignalsProvider {
  register(signo: number, handler: number): Result;
  raiseInterval(signo: number, intervalNs: bigint): Result;
}

export interface SocketsProvider {
  open(af: number, type: number, proto: number): number;
  bind(fd: number, addr: SockAddr): Result;
  connect(fd: number, addr: SockAddr): Result;
  listen(fd: number, backlog: number): Result;
  accept(fd: number): number;
  send(fd: number, bufs: Uint8Array[], flags: number): number;
  recv(fd: number, bufs: Uint8Array[], flags: number): SockRecvResult;
  shutdown(fd: number, how: number): Result;
  addrResolve(host: string, port: number, hints: AddrHints): SockAddr[];
}

export interface ProcProvider {
  id(): number;
  parentId(): number;
  fork(): ProcForkResult;
  spawn(req: ProcSpawnRequest): number;
  exec(req: ProcExecRequest): Result;
  join(pid: number): ProcExitInfo;
}
