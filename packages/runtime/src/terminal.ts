// TODO: Use this version when deploying?
//import WasmTerminal from "@wasmer/wasm-terminal/lib/optimized/wasm-terminal.esm";
import WasmTerminal from "@wasmer/wasm-terminal";
import processWorkerURL from "@wasmer/wasm-terminal/lib/workers/process.worker.js?url";
import { WasmFs } from "./wasmfs";

import WAPM from "./wapm/wapm";

async function waitForTimeout(millis: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, millis);
  });
}

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
    this.wapm = new WAPM(this.wasmTerminal, this.wasmFs);

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
  async runCommand(command: string): Promise<void> {
    // Wait for the terminal to open and start prompting
    // this is necessary or the terminal won't execute the command
    // (limitation of WasmTerminal)
    while (!this.isReadyForCommand()) {
      await waitForTimeout(50);
    }

    this.wasmTerminal.runCommand(command);
    this.focus();

    // Now wait for it to complete running the command
    while (!this.isReadyForCommand()) {
      await waitForTimeout(50);
    }
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
