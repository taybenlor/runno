// TODO: Use this version when deploying?
//import WasmTerminal from "@wasmer/wasm-terminal/lib/optimized/wasm-terminal.esm";
import WasmTerminal from "@make-run/terminal";
import processWorkerURL from "@make-run/terminal/lib/workers/process.worker.js?url";
import { WasmFs } from "./wasmfs";
import { CommandResult } from "./types";

import WAPM from "./wapm/wapm";

export class Terminal {
  wasmFs: WasmFs;
  wasmTerminal: WasmTerminal;
  wapm: WAPM;

  constructor(terminalEl: HTMLElement) {
    this.wasmFs = new WasmFs();
    this.wasmTerminal = new WasmTerminal({
      processWorkerUrl: processWorkerURL,
      fetchCommand: this.fetchCommand.bind(this),
      wasmFs: this.wasmFs,
    });
    this.wapm = new WAPM(this.wasmFs, this.wasmTerminal);

    this.wasmTerminal.open(terminalEl);
    window.addEventListener("resize", () => {
      this.wasmTerminal.fit();
    });
  }

  async fetchCommand(options: any) {
    return await this.wapm.runCommand(options);
  }

  writeFile(path: string, content: string | Buffer | Uint8Array) {
    this.wasmFs.volume.writeFileSync(path, content);
  }

  async getStdout(): Promise<string> {
    const stdout = await this.wasmFs.getStdOut();
    return stdout.toString();
  }

  /**
   * Run a command and then wait for it to complete executing.
   * Promise resolves when the command is finished.
   *
   * @param command the raw terminal command to run
   */
  runCommand(command: string): Promise<CommandResult> {
    const promise = this.wasmTerminal.runCommandDirect(command);
    this.focus();
    return promise;
  }

  isReadyForCommand(): boolean {
    return (
      this.wasmTerminal.isOpen && this.wasmTerminal.wasmShell.isPrompting()
    );
  }

  focus() {
    this.wasmTerminal.focus();
  }
}
