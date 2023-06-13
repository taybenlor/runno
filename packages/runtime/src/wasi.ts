import { html, css, LitElement, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import type { RunResult } from "@runno/host";
import xtermcss from "xterm/css/xterm.css";
import { Terminal } from "xterm";
import { WebLinksAddon } from "xterm-addon-web-links";
import { FitAddon } from "xterm-addon-fit";
import { WASIFS, WASIWorkerHost, WASIWorkerHostKilledError } from "@runno/wasi";
import { makeRunnoError } from "./helpers";

export class WASIElement extends LitElement {
  @property()
  src: string = "";

  @property()
  name: string = "program";

  @property({ type: String, attribute: "args-json" })
  argsJSON?: string;

  @property({ type: String, attribute: "env-json" })
  envJSON?: string;

  @property({ type: Boolean, attribute: "disable-echo" })
  disableEcho: boolean = false;

  @property({ type: Boolean, attribute: "disable-tty" })
  disableTTY: boolean = false;

  @property({ type: Boolean })
  controls: boolean = false;

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

  get args(): string[] {
    if (!this.argsJSON) {
      return [];
    }

    try {
      return JSON.parse(this.argsJSON);
    } catch (e) {
      return [];
    }
  }

  get env(): Record<string, string> {
    if (!this.envJSON) {
      return {};
    }

    try {
      return JSON.parse(this.envJSON);
    } catch (e) {
      return {};
    }
  }

  static styles = css`
    :host {
      position: relative;
    }

    * {
      box-sizing: border-box;
    }

    ${unsafeCSS(xtermcss)}

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
  `;

  constructor() {
    super();

    this.terminal.onData(this.onTerminalData);
    this.terminal.onKey(this.onTerminalKey);

    this.resizeObserver = new ResizeObserver(this.onResize);
  }

  render() {
    return html`<div id="container"></div>`;
  }

  //
  // Public Helpers
  //

  async run(
    binaryPath: string,
    binaryName: string,
    fs: WASIFS,
    args: string[],
    env: { [key: string]: string }
  ): Promise<RunResult> {
    if (this.workerHost) {
      this.workerHost.kill();
    }

    this.terminal.reset();
    this.terminal.focus();

    try {
      let stdout = "";
      let stderr = "";

      this.workerHost = new WASIWorkerHost(binaryPath, {
        args: [binaryName, ...args],
        env,
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
      this.terminal.write(`\nRunno crashed: ${e}`);
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
    this.terminal.open(this.shadowRoot?.getElementById("container")!);
    this.fitAddon.fit();

    window.addEventListener("resize", this.onResize);
    this.resizeObserver.observe(this);
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver.unobserve(this);
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

    if (this.echoStdin) {
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
