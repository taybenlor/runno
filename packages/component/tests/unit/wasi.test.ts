import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { cli, clocks, io } from "@bytecodealliance/preview2-shim";

import { instantiateComponent } from "../../lib/main.ts";

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/**
 * Runs a real WASI 0.2 command component (Rust wasm32-wasip2) against
 * jco's preview2-shim — the ecosystem-compatibility proof: unmodified
 * components + unmodified shims.
 */
test("runs a Rust wasm32-wasip2 component with preview2-shim", async () => {
  const bytes = new Uint8Array(await readFile(fixture("wasi/hello.wasm")));

  cli._setArgs(["hello.wasm", "one", "two"]);
  cli._setEnv({ RUNNO_TEST: "it-works" });

  // Capture stdout writes from the shim's OutputStream.
  let output = "";
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  }) as typeof process.stdout.write;

  try {
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

    const runKey = Object.keys(exports).find((k) =>
      k.startsWith("wasi:cli/run"),
    );
    assert.ok(runKey, "component exports wasi:cli/run");
    const runInterface = exports[runKey!] as { run: () => void };
    runInterface.run();
  } finally {
    process.stdout.write = original;
  }

  assert.match(output, /Hello from WASI 0\.2!/);
  assert.match(output, /args: one,two/);
  assert.match(output, /env: it-works/);
});
