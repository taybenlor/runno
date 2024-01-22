import type { RunResult } from "../types";
import xtermcss from "xterm/css/xterm.css?inline";
import { Terminal } from "xterm";
import { WebLinksAddon } from "xterm-addon-web-links";
import { FitAddon } from "xterm-addon-fit";
import { WASIFS, WASIWorkerHost, WASIWorkerHostKilledError } from "@runno/wasi";
import { fetchWASIFS, makeRunnoError } from "../helpers";
import { FileElement } from "./file";
import { ControlsElement } from "./controls";

const ATTRIBUTE_MAP = {
  src: "src",
  name: "name",
  args: "args",
  "disable-echo": "disableEcho",
  "disable-tty": "disableTTY",
  controls: "controls",
  autorun: "autorun",
  "fs-url": "fsURL",
} as const;

const BOOLEAN_ATTRIBUTES = [
  "disable-echo",
  "disable-tty",
  "controls",
  "autorun",
];

type BooleanAttribute = "disable-echo" | "disable-tty" | "controls" | "autorun";

function isBooleanAttribute(key: string): key is BooleanAttribute {
  return BOOLEAN_ATTRIBUTES.includes(key);
}

export class WASIElement extends HTMLElement {
  static get observedAttributes() {
    return Object.keys(ATTRIBUTE_MAP);
  }

  src: string = "";
  name: string = "program";
  args: string[] = [];
  env: Record<string, string> = {};
  fs: WASIFS = {};
  fsURL: string = "";

  // Boolean controls
  disableEcho: boolean = false;
  disableTTY: boolean = false;
  _controls: boolean = false;
  autorun: boolean = false;

  // Terminal Display
  terminal: Terminal = new Terminal({
    convertEol: true,
    altClickMovesCursor: false,
  });
  fitAddon: FitAddon = new FitAddon();
  resizeObserver: ResizeObserver;

  // Runtime State
  workerHost?: WASIWorkerHost;
  stdinHistory: string = "";
  ttyHistory: string = "";

  private hasRun = false;

  get controls() {
    return this._controls;
  }

  set controls(value: boolean) {
    this._controls = value;

    const el =
      this.shadowRoot!.querySelector<ControlsElement>("runno-controls");
    if (!el) {
      return;
    }

    if (value) {
      el.removeAttribute("hidden");
    } else {
      el.setAttribute("hidden", "");
    }
  }

  private _running = false;
  get running() {
    return this._running;
  }

  set running(value: boolean) {
    this._running = value;

    const el =
      this.shadowRoot!.querySelector<ControlsElement>("runno-controls");
    if (!el) {
      return;
    }

    el.running = value;
  }

  constructor() {
    super();

    this.terminal.onData(this.onTerminalData);
    this.terminal.onKey(this.onTerminalKey);

    this.resizeObserver = new ResizeObserver(this.onResize);

    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
    <style>
      :host {
        display: block;
        position: relative;
        min-height: 140px;
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
        background: black;
        height: var(--runno-terminal-height, auto);
        min-height: var(--runno-terminal-min-height, 4rem);
      }

      runno-controls {
        position: absolute;
        top: 0;
        right: 0;
        border: 0.5em solid black;
        z-index: 5; /* In front of container */
        --runno-controls-margin: 0px;
      }
    </style>
    <runno-controls hidden></runno-controls>
    <div id="container"></div>
    `;
  }

  //
  // Public Helpers
  //

  async run(): Promise<RunResult> {
    this.hasRun = true;

    if (this.workerHost) {
      this.workerHost.kill();
    }

    this.terminal.reset();
    this.terminal.focus();

    let fs: WASIFS = this.fs;

    if (this.fsURL) {
      const baseFS = await fetchWASIFS(this.fsURL);
      fs = { ...baseFS, ...fs };
    }

    const fileElements = Array.from(
      this.querySelectorAll<FileElement>("runno-file")
    );
    const files = await Promise.all(fileElements.map((f) => f.getFile()));
    for (const file of files) {
      fs[file.path] = file;
    }

    try {
      let stdout = "";
      let stderr = "";

      // TODO: this should also do window.location.origin + window.location.pathname trimmed to the last /
      const url = new URL(this.src, window.location.origin);
      this.workerHost = new WASIWorkerHost(url.toString(), {
        args: [this.name, ...this.args],
        env: this.env,
        fs,
        isTTY: true,
        stdout: (out) => {
          stdout += out;
          this.ttyHistory += out;
          this.terminal.write(out);
        },
        stderr: (err) => {
          stderr += err;
          this.ttyHistory += err;
          this.terminal.write(err); // TODO: Different colour?
        },
        debug: (...args) => {
          console.log("DEBUG", ...args);
          return args[2];
        },
      });
      const result = await this.workerHost.start();
      return {
        resultType: "complete",
        ...result,
        stdout,
        stderr,
        stdin: this.stdinHistory,
        tty: this.ttyHistory,
      };
    } catch (e) {
      if (e instanceof WASIWorkerHostKilledError) {
        return { resultType: "terminated" };
      }
      console.error(e);
      if (
        e != null &&
        (e instanceof Error || (typeof e === "object" && "message" in e))
      ) {
        this.terminal.write(
          `\n[Crashed] ${(e as any).type ?? "Error"}: ${e.message}\n`
        );
      }
      return { resultType: "crash", error: makeRunnoError(e) };
    } finally {
      this.workerHost = undefined;
    }
  }

  //
  // Lifecycle Methods
  //

  connectedCallback() {
    this.terminal.loadAddon(new WebLinksAddon());
    this.terminal.loadAddon(this.fitAddon);
    setTimeout(() => {
      this.terminal.open(this.shadowRoot?.getElementById("container")!);
      this.fitAddon.fit();
    });

    window.addEventListener("resize", this.onResize);
    this.resizeObserver.observe(this);

    this.addEventListener("runno-run", this.onRunEvent);
    this.addEventListener("runno-stop", this.onStopEvent);

    if (this.autorun) {
      // Schedule for next frame, after DOM is fully mounted
      // Important for nested files
      setTimeout(this.onAutorun);
    }
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver.unobserve(this);

    this.removeEventListener("runno-run", this.onRunEvent);
    this.removeEventListener("runno-stop", this.onStopEvent);
  }

  attributeChangedCallback(
    name: keyof typeof ATTRIBUTE_MAP,
    _: string,
    newValue: string
  ) {
    if (name === "args") {
      this.args = newValue.trim() ? newValue.trim().split(" ") : [];
      return;
    }

    if (name === "autorun") {
      this.autorun = true;
      setTimeout(this.onAutorun);
    }

    if (isBooleanAttribute(name)) {
      this[ATTRIBUTE_MAP[name]] = newValue !== null;
    } else {
      this[ATTRIBUTE_MAP[name]] = newValue;
    }
  }

  //
  // Events
  //

  onTerminalData = async (data: string) => {
    if (!this.workerHost) {
      return;
    }

    if (data === "\r") {
      data = "\n";
    }

    if (!this.disableEcho) {
      // TODO: Parse backspace etc
      this.terminal.write(data);
    }

    await this.workerHost.pushStdin(data);
    this.stdinHistory += data;
  };

  onTerminalKey = ({ domEvent }: { key: string; domEvent: KeyboardEvent }) => {
    if (domEvent.ctrlKey && domEvent.key === "d") {
      domEvent.preventDefault();
      domEvent.stopPropagation();

      this.onTerminalEOF();
    }
  };

  onTerminalEOF = async () => {
    this.workerHost?.pushEOF();
  };

  onResize = () => {
    this.fitAddon.fit();
  };

  onRunEvent = () => {
    this.run();
  };

  onStopEvent = () => {
    this.stop();
  };

  onAutorun = () => {
    if (!this.hasRun && this.isConnected) {
      this.run();
    }
  };

  //
  // Helpers
  //

  stop() {
    this.workerHost?.kill();
    this.workerHost = undefined;
  }

  focus() {
    this.terminal.focus();
  }

  clear() {
    this.terminal.clear();
  }
}

customElements.define("runno-wasi", WASIElement);
