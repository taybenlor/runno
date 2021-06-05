// import "normalize.css";
// import "./style";
import { Component } from "preact";
// import WasmTerminal from "@wasmer/wasm-terminal";
import WasmTerminal from '@wasmer/wasm-terminal/lib/optimized/wasm-terminal.esm';
import { WasmFs } from "@wasmer/wasmfs";

import WAPM from './services/wapm/wapm';


const readFileAsBuffer = file => {
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = event => {
      resolve(event.target.result);
    };
    fileReader.onabout = () => {
      reject();
    };
    fileReader.readAsArrayBuffer(file);
  });
};

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

  async fetchCommand (options) {
    let commandName = options.args[0];
    if (window.gtag) {
      window.gtag('event', 'run command', {
        // 'event_category': '',
        'event_label': commandName,
        // 'value': '<here the command args and environment>'
      });
    }
    return await this.wapm.runCommand(options);
  };
  
  componentDidMount() {
    const asyncTask = async () => {
      let params = this._handleQueryParams();
      await this._setupWasmTerminal(params.inline);
      this._setupDropZone();
      if (params.runCommand) {
        // console.log(params.runCommand);
        setTimeout(
          () => this.wasmTerminal.runCommand(params.runCommand),
        50);
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
    const openedPromise = new Promise(resolve => {
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

  _setupDropZone() {
    this.dropZone = document.querySelector("#drop-zone");

    // Handle the respective drag events, and prevent default to stop the browser from opening the file
    document.body.addEventListener("dragenter", event => {
      event.preventDefault();
      if (!this.dropZone.classList.contains("fade")) {
        this.dropZone.classList.add("fade");
      }
      this.dropZone.classList.add("active");
    });
    document.body.addEventListener("dragover", event => {
      event.preventDefault();
      if (!this.dropZone.classList.contains("active")) {
        this.dropZone.classList.add("active");
      }
    });
    document.body.addEventListener("dragleave", event => {
      event.preventDefault();
      this.dropZone.classList.remove("active");
    });
    document.body.addEventListener("drop", event => {
      event.preventDefault();

      // From MDN under Public Domain:
      // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop

      // Remove the active class
      this.dropZone.classList.remove("active");

      // Use DataTransferItemList interface to access the file(s)
      if (event.dataTransfer.items) {
        for (var i = 0; i < event.dataTransfer.items.length; i++) {
          // If dropped items aren't files, reject them
          if (event.dataTransfer.items[i].kind === "file") {
            var file = event.dataTransfer.items[i].getAsFile();
            this._handleDropFile(file);
          }
        }
      } else {
        // Use DataTransfer interface to access the file(s)
        for (var i = 0; i < event.dataTransfer.files.length; i++) {
          this._handleDropFile(event.dataTransfer.files[i]);
        }
      }
    });
  }

  async _handleDropFile(file) {
    const fileBuffer = await readFileAsBuffer(file);
    const fileBinary = new Uint8Array(fileBuffer);

    this.wasmFs.volume.writeFileSync(`/tmp/${file.name}`, fileBinary);
    this.wasmTerminal.print(`File uploaded successfully to /tmp
→ /tmp/${file.name}`);

    if (file.name.endsWith(".wasm")) {
      const commandName = file.name.replace(".wasm", "");
      await this.wapm.installWasmBinary(commandName, fileBinary);

      this.wasmTerminal.print(`WebAssembly file detected: ${file.name}
→ Installed commands: ${commandName}`);
    }
  }

  _handleQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      runCommand: params.get("run-command"),
      inline: params.has("inline"),
    }
  }
}
