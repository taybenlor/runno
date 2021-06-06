// import "normalize.css";
import { Component, createRef } from "preact";
import WasmTerminal from "@wasmer/wasm-terminal";
// TODO: Use this version when deploying?
// import WasmTerminal from "@wasmer/wasm-terminal/lib/optimized/wasm-terminal.esm";
import { WasmFs } from "@wasmer/wasmfs";

import WAPM from "./services/wapm/wapm";

export default class App extends Component {
  terminalRef = createRef();

  constructor() {
    super();

    this.wasmFs = new WasmFs();

    const wasmTerminal = new WasmTerminal({
      processWorkerUrl: "/assets/vendor/wasm-terminal/process.worker.js",
      fetchCommand: this.fetchCommand.bind(this),
      wasmFs: this.wasmFs,
    });
    this.wapm = new WAPM(wasmTerminal, this.wasmFs);

    this.resizing = false;
    this.wasmTerminal = wasmTerminal;

    if (window) {
      window.addEventListener("resize", this.onResize.bind(this));
    }
  }

  async fetchCommand(options) {
    return await this.wapm.runCommand(options);
  }

  startCommandFromParams() {
    let command = "echo unsupported command specified";

    const params = new URLSearchParams(window.location.search);
    let code = params.get("code") || undefined;
    if (params.get("wapm")) {
      command = params.get("wapm");
    } else if (params.get("runtime")) {
      const runtime = params.get("runtime");
      if (runtime === "python") {
        command = "python";
      }
    } else {
      // No command was specified
      return;
    }

    this.startCommand(command, code);
  }

  /**
   * Starts a runtime for execution
   *
   * @param {string} command - The name of the WAPM package to run
   * @param {string=} code - The code to pass as a file
   */
  startCommand(command, code) {
    this.wasmFs.volume.writeFileSync("/program", code);

    // If theres code, pass it as the first argument to command
    this.wasmTerminal.runCommand(`${command}${code ? " program" : ""}`);
  }

  //
  // Preact Lifecycle Methods
  //

  componentDidMount() {
    this.wasmTerminal.open(this.terminalRef.current);
    setTimeout(() => this.startCommandFromParams(), 50);
  }

  componentWillUnmount() {
    if (window) {
      window.removeEventListener("resize", this.onResize.bind(this));
    }
  }

  onResize() {
    // TODO: Use a debouncer instead
    if (!this.resizing) {
      this.resizing = true;
      setTimeout(() => {
        this.wasmTerminal.fit();
        this.resizing = false;
      }, 16);
    }
  }

  render() {
    return (
      <div class="fullscreen">
        <main ref={this.terminalRef} id="wasm-terminal" />
      </div>
    );
  }
}
