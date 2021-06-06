// import "normalize.css";
// import "./style";
import { Component } from "preact";
// import WasmTerminal from "@wasmer/wasm-terminal";
import WasmTerminal from "@wasmer/wasm-terminal/lib/optimized/wasm-terminal.esm";
import { WasmFs } from "@wasmer/wasmfs";

import WAPM from "./services/wapm/wapm";

export default class App extends Component {
  constructor() {
    super();

    this.wasmFs = new WasmFs();
    // For the file uploads
    this.wasmFs.fs.mkdirSync("/tmp/", { recursive: true });

    const wasmTerminal = new WasmTerminal({
      processWorkerUrl: "/assets/vendor/wasm-terminal/process.worker.js",
      fetchCommand: this.fetchCommand.bind(this),
      wasmFs: this.wasmFs,
    });
    this.wapm = new WAPM(wasmTerminal, this.wasmFs);

    this.resizing = false;
    this.wasmTerminal = wasmTerminal;
    this.dropZone = undefined;

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
      await this._setupWasmTerminal(params.inline);
      this._setupDropZone();
      if (params.runCommand) {
        // console.log(params.runCommand);
        setTimeout(() => this.wasmTerminal.runCommand(params.runCommand), 50);
      }
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
        <div id="drop-zone">
          <h1>Please drop a `.wasm` module or any other asset.</h1>
        </div>
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

    // Xterm has this weird bug where it won' fit correctly
    // Thus, create a watcher to force it to fit
    // And stop watching once we fit to 90% height
    const fitXtermOnLoadWatcher = () => {
      const xtermScreen = document.querySelector(".xterm-screen");
      const body = document.body;
      if (xtermScreen) {
        const xtermScreenHeight = xtermScreen.offsetHeight;
        const bodyHeight = body.offsetHeight;
        this.wasmTerminal.fit();
        this.wasmTerminal.focus();
        if (xtermScreenHeight / bodyHeight > 0.9) {
          resolveOpenPromise();
          return;
        }
      }

      setTimeout(() => fitXtermOnLoadWatcher(), 50);
    };
    fitXtermOnLoadWatcher();

    return openedPromise;
  }

  _handleQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      runCommand: params.get("run-command"),
      inline: params.has("inline"),
    };
  }
}
