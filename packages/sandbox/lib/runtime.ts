import type {
  WASIFS,
  WASIExecutionResult,
  WASIContextOptions,
} from "@runno/wasi";
import {
  Command,
  commandsForRuntime,
  getBinaryPathFromCommand,
} from "./commands.js";
import { fetchWASIFS, makeURLFromFilePath, makeRunnoError } from "./helpers.js";
import { CompleteResult, RunResult, Runtime } from "./types.js";
import { WASIWorkerHost, WASIWorkerHostKilledError } from "./host.js";

export function runCode(
  runtime: Runtime,
  code: string,
  options: {
    stdin?:
      | string
      | AsyncIterable<string>
      | ReadableStream<string>
      | (() => AsyncIterable<string> | ReadableStream<string>);
    timeout?: number;
  } = {},
): Promise<RunResult> {
  const fs: WASIFS = {
    "/program": {
      path: "program",
      content: code,
      mode: "string",
      timestamps: {
        access: new Date(),
        modification: new Date(),
        change: new Date(),
      },
    },
  };

  return runFS(runtime, "/program", fs, options);
}

export async function runFS(
  runtime: Runtime,
  entryPath: string,
  fs: WASIFS,
  options: {
    // Accept string (existing behaviour) or stream-like types for streaming stdin.
    stdin?:
      | string
      | AsyncIterable<string>
      | ReadableStream<string>
      | (() => AsyncIterable<string> | ReadableStream<string>);
    timeout?: number;
  } = {},
): Promise<RunResult> {
  const commands = commandsForRuntime(runtime, entryPath);

  let prepare: CompleteResult;
  try {
    prepare = await headlessPrepareFS(commands.prepare ?? [], fs);
    fs = prepare.fs;
  } catch (e) {
    if (e instanceof TimeoutError) {
      return {
        resultType: "timeout",
      };
    }

    return {
      resultType: "crash",
      error: makeRunnoError(e),
    };
  }

  const { run } = commands;
  const binaryPath = getBinaryPathFromCommand(run, fs);

  if (run.baseFSURL) {
    try {
      const baseFS = await fetchWASIFS(run.baseFSURL);
      fs = { ...fs, ...baseFS };
    } catch (e) {
      return {
        resultType: "crash",
        error: makeRunnoError(e),
      };
    }
  }

  const isStreamInput =
    options.stdin != null &&
    (isAsyncIterable(options.stdin) ||
      isReadableStream(options.stdin) ||
      typeof options.stdin === "function");

  const workerHost = new WASIWorkerHost(binaryPath, {
    args: [run.binaryName, ...(run.args ?? [])],
    env: run.env,
    fs,
    stdout: (out: string) => {
      prepare.stdout += out;
      prepare.tty += out;
    },
    stderr: (err: string) => {
      prepare.stderr += err;
      prepare.tty += err;
    },
  });

  // Start the worker
  const runPromise = workerHost.start();

  // push chunks asynchronously
  const stdinPromise = (async () => {
    try {
      if (isStreamInput) {
        // normalize to AsyncIterable<string>
        let asyncIter: AsyncIterable<string> | undefined;

        if (isAsyncIterable(options.stdin)) {
          asyncIter = options.stdin as AsyncIterable<string>;
        } else if (isReadableStream(options.stdin)) {
          asyncIter = readableStreamToAsyncIterable(
            options.stdin as ReadableStream<string>,
          );
        } else if (typeof options.stdin === "function") {
          const result = (
            options.stdin as () =>
              | AsyncIterable<string>
              | ReadableStream<string>
          )();
          if (isAsyncIterable(result)) {
            asyncIter = result;
          } else if (isReadableStream(result)) {
            asyncIter = readableStreamToAsyncIterable(result);
          }
        }
        if (asyncIter) {
          for await (const chunk of asyncIter) {
            if (!workerHost.isRunning) break;
            await pushStringSafely(workerHost, chunk);
          }
        }
      } else if (typeof options.stdin === "string") {
        await pushStringSafely(workerHost, options.stdin);
      }
    } finally {
      // signal EOF
      await workerHost.pushEOF();
    }
  })();

  // Prevent unhandled rejections if stdinPromise fails before we await it.
  stdinPromise.catch(() => {});

  try {
    // Wrap stdinPromise to only reject on error, and not resolve the race on success
    const stdinErrorPromise = stdinPromise.then(
      () => new Promise<never>(() => {}),
    );

    let result: WASIExecutionResult | "timeout";
    if (options.timeout) {
      const timeoutPromise: Promise<"timeout"> = new Promise((resolve) =>
        setTimeout(() => resolve("timeout"), options.timeout! * 1000),
      );
      result = await Promise.race([
        runPromise,
        timeoutPromise,
        stdinErrorPromise,
      ]);
    } else {
      result = await Promise.race([runPromise, stdinErrorPromise]);
    }

    if (result === "timeout") {
      workerHost.kill();
      await stdinPromise.catch(() => {}); // cleanup
      return {
        resultType: "timeout",
      };
    }

    // Ensure we also wait for any errors in the stdin background task
    await stdinPromise;

    prepare.fs = { ...fs, ...result.fs };
    prepare.exitCode = result.exitCode;

    return prepare;
  } catch (e) {
    if (
      e instanceof TimeoutError ||
      e instanceof WASIWorkerHostKilledError ||
      (e && (e as any).constructor?.name === "WASIWorkerHostKilledError")
    ) {
      return {
        resultType: "timeout",
      };
    }

    return {
      resultType: "crash",
      error: makeRunnoError(e),
    };
  }
}

type PrepareErrorData = {
  stdin: string;
  stdout: string;
  stderr: string;
  tty: string;
  fs: WASIFS;
  exitCode: number;
};
export class PrepareError extends Error {
  data: PrepareErrorData;

  constructor(message: string, data: PrepareErrorData) {
    super(message);
    this.data = data;
  }
}

export async function headlessPrepareFS(
  prepareCommands: Command[],
  fs: WASIFS,
  limits: Partial<Limits> = {},
) {
  const prepare: CompleteResult = {
    resultType: "complete",
    stdin: "",
    stdout: "",
    stderr: "",
    tty: "",
    fs,
    exitCode: 0,
  };

  for (const command of prepareCommands) {
    const binaryPath = getBinaryPathFromCommand(command, prepare.fs);

    if (command.baseFSURL) {
      const baseFS = await fetchWASIFS(command.baseFSURL);
      prepare.fs = { ...prepare.fs, ...baseFS };
    }

    const resultWithLimits = await _startWASIWithLimits(
      binaryPath,
      {
        args: [command.binaryName, ...(command.args ?? [])],
        env: command.env,
        fs: prepare.fs,
        stdout: (out: string) => {
          prepare.stdout += out;
          prepare.tty += out;
        },
        stderr: (err: string) => {
          prepare.stderr += err;
          prepare.tty += err;
        },
      },
      limits,
    );

    prepare.fs = resultWithLimits.result.fs;
    prepare.exitCode = resultWithLimits.result.exitCode;

    // Consume the timeout
    limits.timeout = resultWithLimits.remainingLimits.timeout;

    if (resultWithLimits.result.exitCode !== 0) {
      // If a prepare step fails then we stop.
      throw new PrepareError(
        "Prepare step returned a non-zero exit code",
        prepare,
      );
    }
  }

  return prepare;
}

type Limits = {
  timeout: number;
};

type WASIExecutionResultWithLimits = {
  result: WASIExecutionResult;
  remainingLimits: Partial<Limits>;
};

type Context = Omit<WASIContextOptions, "stdin"> & { stdin: string };

async function _startWASIWithLimits(
  binaryPath: string,
  context: Partial<Context>,
  limits: Partial<Limits>,
): Promise<WASIExecutionResultWithLimits> {
  const startTime = performance.now();
  const workerHost = new WASIWorkerHost(
    makeURLFromFilePath(binaryPath),
    context,
  );

  if (context.stdin) {
    workerHost.pushStdin(context.stdin);
  }

  let result: WASIExecutionResult | "timeout";
  if (limits.timeout) {
    const timeoutPromise: Promise<"timeout"> = new Promise((resolve) =>
      setTimeout(() => resolve("timeout"), limits.timeout! * 1000),
    );

    result = await Promise.race([workerHost.start(), timeoutPromise]);
  } else {
    result = await workerHost.start();
  }

  if (result === "timeout") {
    workerHost.kill();
    throw new TimeoutError();
  }

  const endTime = performance.now();

  return {
    result,
    remainingLimits: {
      timeout: limits.timeout
        ? limits.timeout - (endTime - startTime) / 1000
        : undefined,
    },
  };
}

class TimeoutError extends Error {
  constructor() {
    super("Execution timed out");
  }
}

/*
  Helper utilities for streaming stdin support
*/

// Type guards
function isAsyncIterable(x: any): x is AsyncIterable<string> {
  return !!x && typeof x[Symbol.asyncIterator] === "function";
}

function isReadableStream(x: any): x is ReadableStream<string> {
  return !!x && typeof (x as any).getReader === "function";
}

async function* readableStreamToAsyncIterable(
  stream: ReadableStream<string>,
): AsyncIterable<string> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value != null) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

// Split a Uint8Array into chunks <= maxBytes, ensuring we don't cut in the middle
// of a UTF-8 multi-byte sequence (by avoiding continuation bytes 0x80..0xBF at chunk end).
function splitUint8ArrayIntoUtf8SafeSlices(
  bytes: Uint8Array,
  maxBytes: number,
): Uint8Array[] {
  const out: Uint8Array[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    // Proposed end
    let end = Math.min(offset + maxBytes, bytes.length);

    // If end is at bytes.length we're done; otherwise ensure end is not a UTF-8 continuation byte.
    if (end < bytes.length) {
      // Move end left until not a continuation byte (0b10xxxxxx)
      while (end > offset && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
        end -= 1;
      }
      // Edge case: if we couldn't move (a single codepoint > maxBytes), fall back to forcing split
      // at maxBytes (this will likely produce replacement chars, but unavoidable unless buffer bigger).
      if (end === offset) {
        end = Math.min(offset + maxBytes, bytes.length);
      }
    }

    out.push(bytes.slice(offset, end));
    offset = end;
  }
  return out;
}

// Safely push a JS string to workerHost by splitting it into UTF-8-safe sub-strings
// that fit into the workerHost.stdinBuffer (availableBytes = buffer.byteLength - 4).
async function pushStringSafely(host: WASIWorkerHost, str: string) {
  if (!str) {
    return;
  }
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  // compute max payload bytes (subtract 4 bytes used as header)
  const totalBytes = (host.stdinBuffer as SharedArrayBuffer).byteLength;
  const maxPayload = Math.max(0, totalBytes - 4);
  if (bytes.length <= maxPayload) {
    // small enough, push whole string
    await host.pushStdin(str);
    return;
  }

  // split into safe byte slices, then decode each slice back to string before pushing
  const slices = splitUint8ArrayIntoUtf8SafeSlices(bytes, maxPayload);
  const decoder = new TextDecoder();
  for (const s of slices) {
    const subStr = decoder.decode(s);
    await host.pushStdin(subStr);
  }
}
