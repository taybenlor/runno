import { CompleteResult, RunResult, Runtime } from "@runno/host";
import { WASIFS, WASIWorkerHost } from "@runno/wasi";
import {
  Command,
  commandsForRuntime,
  getBinaryPathFromCommand,
} from "./commands";
import { fetchWASIFS } from "./helpers";

export async function headlessRunCode(
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
  return headlessRunFS(runtime, "/program", fs, stdin);
}

export async function headlessRunFS(
  runtime: Runtime,
  entryPath: string,
  fs: WASIFS,
  stdin?: string
): Promise<RunResult> {
  const commands = commandsForRuntime(runtime, entryPath);

  const prepare = await headlessPrepareFS(commands.prepare ?? [], fs);
  fs = prepare.fs;

  const { run } = commands;
  const binaryPath = getBinaryPathFromCommand(run, fs);

  const workerHost = new WASIWorkerHost(binaryPath, {
    args: [run.binaryName, ...(run.args ?? [])],
    env: run.env,
    fs,
    stdout: (out) => {
      prepare.stdout += out;
      prepare.tty += out;
    },
    stderr: (err) => {
      prepare.stderr += err;
      prepare.tty += err;
    },
  });

  if (stdin) {
    workerHost.pushStdin(stdin);
  }

  const result = await workerHost.start();

  prepare.fs = { ...prepare.fs, ...result.fs };
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

    const workerHost = new WASIWorkerHost(binaryPath, {
      args: [command.binaryName, ...(command.args ?? [])],
      env: command.env,
      fs: prepare.fs,
      stdout: (out) => {
        prepare.stdout += out;
        prepare.tty += out;
      },
      stderr: (err) => {
        prepare.stderr += err;
        prepare.tty += err;
      },
      debug: (...args) => {
        console.log("DEBUG", ...args);
        return args[2];
      },
    });
    const result = await workerHost.start();

    prepare.fs = result.fs;
    prepare.exitCode = result.exitCode;

    if (result.exitCode !== 0) {
      // TODO: Remove this
      console.error("Prepare failed", prepare);

      // If a prepare step fails then we stop.
      throw new PrepareError(
        "Prepare step returned a non-zero exit code",
        prepare
      );
    }
  }

  return prepare;
}
