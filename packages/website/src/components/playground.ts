import { html, css, unsafeCSS } from "lit";
import { customElement, query, state } from "lit/decorators.js";

import xtermcss from "xterm/css/xterm.css?inline";
import { Terminal } from "xterm";
import { WebLinksAddon } from "xterm-addon-web-links";
import { FitAddon } from "xterm-addon-fit";

import { WASIFS, WASIWorkerHost } from "@runno/wasi";

import { TailwindElement } from "../lib/tailwind";
import { extractTarGz } from "../demos/tar";
import { WASIExample } from "../demos/wasi-examples";

@customElement("website-playground")
export class WebsitePlayground extends TailwindElement {
  static styles = [
    TailwindElement.styles,
    css`
      ${unsafeCSS(xtermcss)}

      .xterm,
      .xterm-viewport,
      .xterm-screen {
        width: 100%;
        height: 100%;
      }
    `,
  ];

  @state()
  args: string[] = [];

  @state()
  binary: File | null = null;

  @state()
  demoBinary: string | null = null;

  @state()
  files: File[] = [];

  @state()
  stdinBuffer: SharedArrayBuffer = new SharedArrayBuffer(8 * 1024); // 8 kB should be enough

  @state()
  showSettings: boolean = false;

  @state()
  echoStdin: boolean = false;

  @state()
  workerHost?: WASIWorkerHost;

  @query("#terminal")
  _terminalElement!: HTMLDivElement;

  @query("#env")
  _envElement!: HTMLTextAreaElement;

  terminal: Terminal = new Terminal({
    convertEol: true,
    altClickMovesCursor: false,
  });
  fitAddon: FitAddon = new FitAddon();

  get binaryName() {
    if (this.demoBinary) {
      return this.demoBinary.split("/").pop()!;
    } else if (this.binary) {
      return this.binary.name;
    } else {
      return null;
    }
  }

  //
  // Public API
  //

  loadDemo(demo: WASIExample) {
    this.demoBinary = demo.binary;
    this.args = demo.args;
    this._envElement.value = demo.env;

    // Overwrite duplicate names
    const demoFileNames = demo.files.map((f) => f.name);
    this.files = this.files.filter((f) => !demoFileNames.includes(f.name));
    this.files = [...demo.files, ...this.files];

    this.echoStdin = !!demo.settings?.echoSTDIN;
  }

  //
  // Terminal Connection
  //

  constructor() {
    super();

    this.terminal.onData(this.onTerminalData);
    this.terminal.onKey(this.onTerminalKey);
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("resize", this.onResize);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.onResize);
  }

  onResize = () => {
    this.fitAddon.fit();
  };

  onTerminalData = async (data: string) => {
    if (data === "\r") {
      data = "\n";
    }

    if (this.echoStdin) {
      // TODO: Parse backspace etc
      this.terminal.write(data);
    }

    this.workerHost?.pushStdin(data);
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

  //
  // Keyboard Handlers
  //

  //
  // Component Event Handlers
  //

  onArgsInput(event: InputEvent) {
    this.args = (event.target as HTMLInputElement).value
      .split(" ")
      .filter((v) => !!v);
  }

  onBinaryInput(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    if (!target.files) {
      return;
    }

    const file = target.files.item(0);
    if (!file) {
      return;
    }

    this.binary = new File([file], file.name, {
      type: "application/wasm",
    });
  }

  onKillClick() {
    this.workerHost?.kill();
    this.workerHost = undefined;
  }

  async onRunClick() {
    if (!this.binary && !this.demoBinary) {
      return;
    }

    const binaryPath = this.demoBinary || URL.createObjectURL(this.binary!);
    const binaryName = this.binaryName!;

    if (this.workerHost) {
      this.workerHost.kill();
    }

    this.terminal.reset();
    this.terminal.focus();

    const fs: WASIFS = {};
    for (const file of this.files) {
      fs[file.name] = {
        path: file.name,
        timestamps: {
          change: new Date(file.lastModified),
          access: new Date(file.lastModified),
          modification: new Date(file.lastModified),
        },
        mode: "binary",
        content: new Uint8Array(await file.arrayBuffer()),
      };
    }

    const vars = this._envElement.value.split("\n");
    const env = Object.fromEntries(vars.map((v) => v.split("=")));

    try {
      this.workerHost = new WASIWorkerHost(binaryPath, {
        args: [binaryName, ...this.args],
        env,
        stdout: (out) => this.terminal.write(out),
        stderr: (err) => this.terminal.write(err), // TODO: Different colour?
        fs,
        isTTY: true,
      });
      const result = await this.workerHost.start();

      this.terminal.write(`\nProgram ended: ${result.exitCode}`);

      const newFiles: File[] = [];
      for (const [path, wasiFile] of Object.entries(result.fs)) {
        newFiles.push(
          new File([wasiFile.content], path, {
            lastModified: wasiFile.timestamps.modification.getTime(),
          })
        );
      }
      this.files = newFiles;
    } catch (e) {
      this.terminal.write(`\nError: ${e}`);
    }

    this.workerHost = undefined;
  }

  async onFilesystemInput(event: InputEvent) {
    const inputElement = event.target as HTMLInputElement;
    const inputFiles = inputElement.files;
    if (!inputFiles) {
      return;
    }

    let newFiles: File[] = [];

    for (const file of Array.from(inputFiles)) {
      if (file.name.endsWith(".tar.gz")) {
        const extractedFiles = await extractTarGz(
          new Uint8Array(await file.arrayBuffer())
        );
        for (const extractedFile of extractedFiles) {
          newFiles.push(extractedFile);
        }
      } else {
        newFiles.push(file);
      }
    }

    // Make sure input file names start with a slash
    newFiles = newFiles.map(
      (file) =>
        new File([file], `/${file.name}`.replaceAll("//", "/"), {
          type: file.type,
          lastModified: file.lastModified,
        })
    );

    this.files = [...newFiles, ...this.files];
    inputElement.files = null;
    inputElement.value = "";
  }

  onUpdateFile(i: number, event: CustomEvent) {
    this.files[i] = event.detail.file;
    this.files = [...this.files];
  }

  onDeleteFile(i: number, _: CustomEvent) {
    this.files.splice(i, 1);
    this.files = [...this.files];
  }

  firstUpdated() {
    const weblinksAddon = new WebLinksAddon();
    this.terminal.loadAddon(weblinksAddon);
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this._terminalElement);
    this.fitAddon.fit();
  }

  render() {
    return html`
      <div class="grid grid-cols-1 lg:grid-cols-5 xl:grid-cols-3 gap-8">
        <div
          class="lg:col-span-3 xl:col-span-2 flex flex-col flex-grow border border-yellow"
        >
          <div class="relative border-b border-yellow h-14">
            <label
              class="
              absolute
              -top-3
              left-4
              px-4
              bg-navy
              text-sm text-yellow
            "
              for="binary"
            >
              Command
            </label>
            <div class="flex justify-between items-stretch h-full">
              <div class="flex-grow flex items-center gap-2 pl-3">
                $
                <label
                  for="binary"
                  class="bg-white rounded py-1 px-2 text-black cursor-pointer text-sm"
                >
                  ${this.binaryName ||
                  html`<em>Choose&nbsp;binary&nbsp;file&hellip;</em>`}
                </label>
                <input
                  id="binary"
                  class="hidden"
                  type="file"
                  placeholder="WASI Binary"
                  @input=${this.onBinaryInput}
                />
                <input
                  value=${this.args.join(" ")}
                  type="text"
                  placeholder="args"
                  @input=${this.onArgsInput}
                  class="bg-transparent flex-grow p-3 h-full min-w-0"
                />
                <button
                  type="button"
                  class="text-yellow px-3 flex-shrink-0"
                  @click=${() => (this.showSettings = !this.showSettings)}
                >
                  Settings
                </button>
              </div>
              ${this.workerHost
                ? html`<button
                    type="button"
                    @click=${this.onKillClick}
                    class="bg-red text-white px-4 font-medium"
                  >
                    Stop
                  </button>`
                : html`<button
                    type="button"
                    @click=${this.onRunClick}
                    class="bg-yellow text-black px-4 font-medium"
                  >
                    Run
                  </button>`}
            </div>
          </div>
          <div class=${this.showSettings ? "h-64 p-3" : "h-64 bg-black p-3"}>
            <div
              class=${this.showSettings ? "hidden" : "w-full h-full relative"}
            >
              <div
                id="terminal"
                class="h-full absolute w-full top-0 left-0"
              ></div>
            </div>

            <div
              class=${this.showSettings
                ? "h-full flex align-items-stretch gap-3"
                : "hidden"}
            >
              <label class="flex-grow relative flex flex-col">
                <span class="text-yellow text-sm mb-1">Environment</span>
                <textarea
                  placeholder=${"SOME_KEY=somevalue\nANOTHER_KEY=anothervalue"}
                  id="env"
                  class="w-full flex-grow text-black p-3"
                  }
                ></textarea>
              </label>
              <div class="w-1/3">
                <div class="mb-1">
                  <label class="text-yellow text-sm">Terminal</label>
                </div>
                <label>
                  <input
                    type="checkbox"
                    @click=${() => (this.echoStdin = !this.echoStdin)}
                  />
                  Echo STDIN
                </label>
              </div>
            </div>
          </div>
        </div>
        <div
          class="lg:col-span-2 xl:col-span-1 flex-grow flex flex-col items-stretch"
        >
          <div class="relative border border-yellow h-full">
            <label
              class="
              absolute
              -top-3
              left-4
              px-4
              bg-navy
              text-sm text-yellow
            "
              for="files"
            >
              Filesystem
            </label>
            <div class="flex flex-col">
              <div class="border-b border-yellow px-3 h-14 flex items-center">
                <label for="filesystem" class="cursor-pointer text-sm">
                  <em class="bg-white rounded py-1 px-2 text-black "
                    >Add files&hellip;</em
                  >
                  <span>Use tar.gz for bulk</span>
                </label>
                <input
                  id="filesystem"
                  class="hidden"
                  type="file"
                  @input=${this.onFilesystemInput}
                />
              </div>
              <div class="h-64 overflow-auto p-3">
                ${this.files.map(
                  (f, i) =>
                    html`
                      <playground-file
                        .file=${f}
                        @file-change=${(event: CustomEvent) =>
                          this.onUpdateFile(i, event)}
                        @file-delete=${(event: CustomEvent) =>
                          this.onDeleteFile(i, event)}
                        class="my-3"
                      ></playground-file>
                    `
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "website-playground": WebsitePlayground;
  }
}
