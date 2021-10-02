// TODO: Use this version when deploying?
//import WasmTerminal from "@wasmer/wasm-terminal/lib/optimized/wasm-terminal.esm";
import WasmTerminal from "@runno/terminal";
import processWorkerURL from "@runno/terminal/lib/workers/process.worker.js?url";
import { WasmFs } from "./wasmfs";
import { CommandResult, FS } from "@runno/host";

import WAPM from "./wapm/wapm";

export class TerminalElement extends HTMLElement {
  wasmFs: WasmFs;
  wasmTerminal: WasmTerminal;
  wapm: WAPM;

  constructor() {
    super();

    this.wasmFs = new WasmFs();
    this.wasmTerminal = new WasmTerminal({
      processWorkerUrl: processWorkerURL,
      fetchCommand: this.fetchCommand.bind(this),
      wasmFs: this.wasmFs,
    });
    this.wapm = new WAPM(this.wasmFs, this.wasmTerminal);

    this.wasmTerminal.open(this);
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
  async runCommand(command: string): Promise<CommandResult> {
    const result = await this.wasmTerminal.runCommandDirect(command);
    // TODO: Internally the Wasmer stuff uses their JSON FS format which can't
    //       hold metadata. It looks like:
    //       {
    //         "somefilename": UInt8Array
    //       }
    //       Here we change it over to:
    //       {
    //         "somefilename": {
    //           name: 'somefilename',
    //           content: UInt8Array
    //         }
    //       }
    //       The idea is that in future we could add metadata to the file struct
    const newfs: FS = {};
    for (const [filename, content] of Object.entries(result.fs)) {
      newfs[filename] = {
        name: filename,
        content: content as Uint8Array,
      };
    }
    return result;
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
