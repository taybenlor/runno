import { CommandRunner, WasmTerminalConfig } from "@make-run/terminal";
import processWorkerURL from "@make-run/terminal/lib/workers/process.worker.js?url";

import { CommandResult } from "./types";
import { WasmFs } from "./wasmfs";
import WAPM from "./wapm/wapm";

class MissingStdinError extends Error {}

export function headlessRunCommand(
  command: string,
  fs?: WasmFs,
  stdin?: string
): Promise<CommandResult> {
  return new Promise<CommandResult>(function (resolve, reject) {
    const wasmfs = fs || new WasmFs();
    const wapm = new WAPM(wasmfs);

    const stdinArr = stdin ? stdin.split("\n") : [];

    const commandRunner = new CommandRunner(
      new WasmTerminalConfig({
        fetchCommand: wapm.runCommand.bind(wapm),
        processWorkerUrl: processWorkerURL,
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
