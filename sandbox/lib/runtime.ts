import { WASIFS, WASI } from "@runno/wasi";
import {
  Command,
  commandsForRuntime,
  getBinaryPathFromCommand,
} from "./commands.ts";
import { fetchWASIFS, makeBlobFromPath, makeRunnoError } from "./helpers.ts";
import { CompleteResult, RunResult, Runtime } from "./types.ts";

export async function runCode(
  runtime: Runtime,
  code: string,
  stdin?: string
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
  return runFS(runtime, "/program", fs, stdin);
}

export async function runFS(
  runtime: Runtime,
  entryPath: string,
  fs: WASIFS,
  stdin?: string
): Promise<RunResult> {
  const commands = commandsForRuntime(runtime, entryPath);

  let prepare: CompleteResult;
  try {
    prepare = await headlessPrepareFS(commands.prepare ?? [], fs);
    fs = prepare.fs;
  } catch (e) {
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

  let stdinBytes = new TextEncoder().encode(stdin ?? "");

  const result = await WASI.start(fetch(makeBlobFromPath(binaryPath)), {
    args: [run.binaryName, ...(run.args ?? [])],
    env: run.env,
    fs,
    stdin: (maxByteLength: number) => {
      const chunk = stdinBytes.slice(0, maxByteLength);
      stdinBytes = stdinBytes.slice(maxByteLength);
      return new TextDecoder().decode(chunk);
    },
    stdout: (out: string) => {
      prepare.stdout += out;
      prepare.tty += out;
    },
    stderr: (err: string) => {
      prepare.stderr += err;
      prepare.tty += err;
    },
  });

  prepare.fs = { ...fs, ...result.fs };
  prepare.exitCode = result.exitCode;

  return prepare;
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
  fs: WASIFS
) {
  let prepare: CompleteResult = {
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

    const result = await WASI.start(fetch(makeBlobFromPath(binaryPath)), {
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
    });

    prepare.fs = result.fs;
    prepare.exitCode = result.exitCode;

    if (result.exitCode !== 0) {
      // If a prepare step fails then we stop.
      throw new PrepareError(
        "Prepare step returned a non-zero exit code",
        prepare
      );
    }
  }

  return prepare;
}
