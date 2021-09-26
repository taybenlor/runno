import { CommandRunner, WasmTerminalConfig } from "@runno/terminal";
import processWorkerURL from "@runno/terminal/lib/workers/process.worker.js?url";

import { CommandResult } from "@runno/host";
import { WasmFs } from "./wasmfs";
import WAPM from "./wapm/wapm";

class MissingStdinError extends Error {}

export function headlessRunCommand(
  command: string,
  fs?: WasmFs,
  stdin?: string
): Promise<CommandResult> {
  return new Promise<CommandResult>(function (resolve) {
    const wasmfs = fs || new WasmFs();
    const wapm = new WAPM(wasmfs);

    const stdinArr = stdin ? stdin.split("\n") : [];

    const commandRunner = new CommandRunner(
      new WasmTerminalConfig({
        fetchCommand: wapm.runCommand.bind(wapm),
        processWorkerUrl: processWorkerURL,
        // This is a conflict between my wasmfs in here vs the terminal
        // Probably terminal should be moved into runtime as well
        // There's not really much value in it being a different package
        // @ts-ignore
        wasmFs: wasmfs,
      }),
      command,
      () => {
        if (stdinArr.length == 0) {
          throw new MissingStdinError(
            "Process requested stdin but none was available"
          );
        }
        return Promise.resolve(stdinArr.shift());
      },
      resolve
    );
    commandRunner.runCommand();
  });
}
