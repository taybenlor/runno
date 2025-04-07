import type {
  WASIFS,
  WASIExecutionResult,
  WASIContextOptions,
} from "@runno/wasi";
import {
  Command,
  commandsForRuntime,
  getBinaryPathFromCommand,
} from "./commands.ts";
import { fetchWASIFS, makeBlobFromPath, makeRunnoError } from "./helpers.ts";
import { CompleteResult, RunResult, Runtime } from "./types.ts";
import { WASIWorkerHost } from "./host.ts";

export function runCode(
  runtime: Runtime,
  code: string,
  options: {
    stdin?: string;
    timeout?: number;
  } = {}
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
    stdin?: string;
    timeout?: number;
  } = {}
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

  try {
    const resultWithLimits = await _startWASIWithLimits(
      binaryPath,
      {
        args: [run.binaryName, ...(run.args ?? [])],
        env: run.env,
        fs,
        stdin: options.stdin,
        stdout: (out: string) => {
          prepare.stdout += out;
          prepare.tty += out;
        },
        stderr: (err: string) => {
          prepare.stderr += err;
          prepare.tty += err;
        },
      },
      {
        timeout: options.timeout,
      }
    );

    prepare.fs = { ...fs, ...resultWithLimits.result.fs };
    prepare.exitCode = resultWithLimits.result.exitCode;

    return prepare;
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
  limits: Partial<Limits> = {}
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
      limits
    );

    prepare.fs = resultWithLimits.result.fs;
    prepare.exitCode = resultWithLimits.result.exitCode;

    // Consume the timeout
    limits.timeout = resultWithLimits.remainingLimits.timeout;

    if (resultWithLimits.result.exitCode !== 0) {
      // If a prepare step fails then we stop.
      throw new PrepareError(
        "Prepare step returned a non-zero exit code",
        prepare
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
  limits: Partial<Limits>
): Promise<WASIExecutionResultWithLimits> {
  const startTime = performance.now();
  const workerHost = new WASIWorkerHost(makeBlobFromPath(binaryPath), context);

  if (context.stdin) {
    workerHost.pushStdin(context.stdin);
  }

  let result: WASIExecutionResult | "timeout";
  if (limits.timeout) {
    const timeoutPromise: Promise<"timeout"> = new Promise((resolve) =>
      setTimeout(() => resolve("timeout"), limits.timeout! * 1000)
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
