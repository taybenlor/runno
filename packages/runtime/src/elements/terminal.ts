import WasmTerminal from "@runno/terminal";
import processWorkerURL from "@runno/terminal/lib/workers/process.worker.js?url";
import { WasmFs } from "../wasmfs";
import { CommandResult, FS } from "@runno/host";
import xtermcss from "xterm/css/xterm.css";

import WAPM from "../wapm/wapm";

export class TerminalElement extends HTMLElement {
  wasmFs: WasmFs;
  wasmTerminal: WasmTerminal;
  wapm: WAPM;
  resizeObserver: ResizeObserver;

  constructor() {
    super();

    this.wasmFs = new WasmFs();
    this.wasmTerminal = new WasmTerminal({
      processWorkerUrl: processWorkerURL,
      fetchCommand: this.fetchCommand.bind(this),
      wasmFs: this.wasmFs,
    });
    this.wapm = new WAPM(this.wasmFs, this.wasmTerminal);
    this.resizeObserver = new ResizeObserver(this.onResize);

    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
    <style>
      :host {
        position: relative;
      }

      * {
        box-sizing: border-box;
      }

      ${xtermcss}
      
      .xterm,
      .xterm-viewport,
      .xterm-screen {
        width: 100%;
        height: 100%;
      }

      #container {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 0.5em;
      }
    </style>
    <div id="container"></div>
    `;
  }

  //
  // Lifecycle Methods
  //

  connectedCallback() {
    this.wasmTerminal.open(this.shadowRoot?.getElementById("container")!);
    window.addEventListener("resize", this.onResize);
    this.wasmTerminal.fit();
    this.resizeObserver.observe(this);
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver.unobserve(this);
  }

  //
  // Helpers
  //

  onResize = () => {
    if (this.wasmTerminal.isOpen) {
      this.wasmTerminal.fit();
    }
  };

  async fetchCommand(options: any) {
    return await this.wapm.runCommand(options);
  }

  writeFile(path: string, content: string | Buffer | Uint8Array) {
    this.wasmFs.volume.writeFileSync(path, content);
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
        content: content as unknown as Uint8Array,
      };
    }
    return result;
  }

  stop() {
    return this.wasmTerminal.kill();
  }

  isReadyForCommand(): boolean {
    return (
      this.wasmTerminal.isOpen && this.wasmTerminal.wasmShell.isPrompting()
    );
  }

  focus() {
    this.wasmTerminal.focus();
  }

  clear() {
    this.wasmTerminal.clear();
  }
}
