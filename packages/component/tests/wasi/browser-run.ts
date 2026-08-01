/**
 * Browser-side runner for the WASI 0.2 smoke test: runs the Rust
 * wasm32-wasip2 hello component against jco's preview2-shim (browser
 * build) and returns captured stdout.
 */

import { cli, clocks, io } from "@bytecodealliance/preview2-shim";

import { instantiateComponent } from "../../lib/main.ts";

export async function runHelloWasi(bytes: Uint8Array): Promise<string> {
  let output = "";
  const decoder = new TextDecoder();

  cli._setArgs(["hello.wasm", "one", "two"]);
  cli._setEnv({ RUNNO_TEST: "it-works" });
  cli._setStdout({
    write(contents: Uint8Array) {
      output += decoder.decode(contents);
    },
    blockingFlush() {},
    [Symbol.dispose]() {},
  });

  const { exports } = await instantiateComponent(bytes, {
    "wasi:cli/environment": cli.environment,
    "wasi:cli/exit": cli.exit,
    "wasi:cli/stdin": cli.stdin,
    "wasi:cli/stdout": cli.stdout,
    "wasi:cli/stderr": cli.stderr,
    "wasi:cli/terminal-input": cli.terminalInput,
    "wasi:cli/terminal-output": cli.terminalOutput,
    "wasi:cli/terminal-stdin": cli.terminalStdin,
    "wasi:cli/terminal-stdout": cli.terminalStdout,
    "wasi:cli/terminal-stderr": cli.terminalStderr,
    "wasi:clocks/monotonic-clock": clocks.monotonicClock,
    "wasi:clocks/wall-clock": clocks.wallClock,
    "wasi:io/error": io.error,
    "wasi:io/poll": io.poll,
    "wasi:io/streams": io.streams,
  });

  const runKey = Object.keys(exports).find((k) => k.startsWith("wasi:cli/run"));
  if (!runKey) {
    throw new Error("component does not export wasi:cli/run");
  }
  (exports[runKey] as { run: () => void }).run();
  return output;
}
