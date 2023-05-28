import { CompleteResult, RunResult, Runtime } from "@runno/host";
import { WASIFS, WASIWorkerHost } from "@runno/wasi-motor";
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
    program: {
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
  return headlessRunFS(runtime, "program", fs, stdin);
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
    const result = await workerHost.start();

    prepare.fs = { ...prepare.fs, ...result.fs };
    prepare.exitCode = result.exitCode;

    if (result.exitCode !== 0) {
      // If a prepare step fails then we stop.
      throw new Error("Prepare step returned a non-zero exitCode");
    }
  }

  return prepare;
}
