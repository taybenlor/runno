// import "normalize.css";
import { Component } from "preact";
// import WasmTerminal from "@wasmer/wasm-terminal";
import WasmTerminal from "@wasmer/wasm-terminal/lib/optimized/wasm-terminal.esm";
import { WasmFs } from "@wasmer/wasmfs";

import WAPM from "./services/wapm/wapm";

export default class App extends Component {
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
    let commandName = options.args[0];
    if (window.gtag) {
      window.gtag("event", "run command", {
        // 'event_category': '',
        event_label: commandName,
        // 'value': '<here the command args and environment>'
      });
    }
    return await this.wapm.runCommand(options);
  }

  componentDidMount() {
    const asyncTask = async () => {
      let params = this._handleQueryParams();
      if (params.runCommand) {
        setTimeout(() => this.wasmTerminal.runCommand(params.runCommand), 50);
      }

      // TODO: There's a bug that prevents this promise from ever resolving
      await this._setupWasmTerminal();
    };
    asyncTask();
  }

  componentWillUnmount() {
    if (window) {
      window.removeEventListener("resize", this.onResize.bind(this));
    }
  }

  onResize() {
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
        <main id="wasm-terminal"></main>
      </div>
    );
  }

  _setupWasmTerminal() {
    // Let's bind our wasm terminal to it's container
    const containerElement = document.querySelector("#wasm-terminal");
    this.wasmTerminal.open(containerElement);

    let resolveOpenPromise = undefined;
    const openedPromise = new Promise((resolve) => {
      resolveOpenPromise = resolve;
    });

    return openedPromise;
  }

  _handleQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      runCommand: params.get("command"),
    };
  }
}
