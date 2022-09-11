import { html, css, unsafeCSS } from "lit";
import { customElement, query, state } from "lit/decorators.js";

import xtermcss from "xterm/css/xterm.css";
import { Terminal } from "xterm";
import { WebLinksAddon } from "xterm-addon-web-links";
import { FitAddon } from "xterm-addon-fit";

import { WASIContext, WASIFS } from "@runno/wasi-motor";

import { TailwindElement } from "../mixins/tailwind";
import { startWithSharedBuffer } from "../runtime/wasi-host";
import { extractTarGz } from "../runtime/tar";

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
  files: File[] = [];

  @state()
  stdinBuffer: SharedArrayBuffer = new SharedArrayBuffer(8 * 1024); // 8 kB should be enough

  @state()
  showSettings: boolean = false;

  @state()
  echoStdin: boolean = false;

  @query("#terminal")
  _terminalElement!: HTMLDivElement;

  @query("#env")
  _envElement!: HTMLTextAreaElement;

  terminal: Terminal = new Terminal({
    convertEol: true,
    altClickMovesCursor: false,
  });

  //
  // Terminal Connection
  //

  constructor() {
    super();

    this.terminal.onData(this.onTerminalData);

    this.terminal.onKey(this.onTerminalKey);
  }

  onTerminalData = async (data: string) => {
    if (data === "\r") {
      data = "\n";
    }

    if (this.echoStdin) {
      // TODO: Parse backspace etc
      this.terminal.write(data);
    }

    const view = new DataView(this.stdinBuffer);

    // Wait until the stdinbuffer is consumed at the other end

    // TODO: This isn't great, should probably use a lock instead
    while (view.getInt32(0) !== 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const encodedText = new TextEncoder().encode(data);
    const buffer = new Uint8Array(this.stdinBuffer, 4);
    buffer.set(encodedText);

    view.setInt32(0, encodedText.byteLength);
    Atomics.notify(new Int32Array(this.stdinBuffer), 0);
  };

  onTerminalKey = ({
    key,
    domEvent,
  }: {
    key: string;
    domEvent: KeyboardEvent;
  }) => {
    if (domEvent.ctrlKey && domEvent.key === "d") {
      domEvent.preventDefault();
      domEvent.stopPropagation();

      this.onTerminalEOF();
    }
  };

  onTerminalEOF = async () => {
    const view = new DataView(this.stdinBuffer);
    // TODO: This isn't great, should probably use a lock instead
    while (view.getInt32(0) !== 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    view.setInt32(0, -1);
    Atomics.notify(new Int32Array(this.stdinBuffer), 0);
  };

  //
  // Keyboard Handlers
  //

  //
  // Component Event Handlers
  //

  onArgsInput(event: InputEvent) {
    this.args = (event.target as HTMLInputElement).value.split(" ");
  }

  onBinaryInput(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    if (!target.files) {
      return;
    }

    this.binary = target.files.item(0);
  }

  async onRunClick() {
    if (!this.binary) {
      return;
    }

    this.terminal.reset();

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
      const result = await startWithSharedBuffer(
        URL.createObjectURL(this.binary),
        this.stdinBuffer,
        new WASIContext({
          args: [this.binary.name, ...this.args],
          env,
          stdout: (out) => this.terminal.write(out),
          stderr: (err) => this.terminal.write(err), // TODO: Different colour?
          stdin: () => prompt("stdin (cancel to end stdin):"),
          fs,
        })
      );

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
  }

  async onFilesystemInput(event: InputEvent) {
    const inputElement = event.target as HTMLInputElement;
    const inputFiles = inputElement.files;
    if (!inputFiles) {
      return;
    }

    const newFiles: File[] = [];

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

    this.files = [...newFiles, ...this.files];
    inputElement.files = null;
    inputElement.value = "";
  }

  onUpdateFile(i: number, event: CustomEvent) {
    this.files[i] = event.detail.file;
    this.files = [...this.files];
  }

  onDeleteFile(i: number, event: CustomEvent) {
    this.files.splice(i, 1);
    this.files = [...this.files];
  }

  firstUpdated() {
    const weblinksAddon = new WebLinksAddon();
    const fitAddon = new FitAddon();
    this.terminal.loadAddon(weblinksAddon);
    this.terminal.loadAddon(fitAddon);
    this.terminal.open(this._terminalElement);
    fitAddon.fit();
  }

  render() {
    return html`
      <div class="flex flex-wrap items-stretch gap-8">
        <div class="flex flex-col flex-grow border border-yellow">
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
                <input
                  class="flex-shrink"
                  type="file"
                  placeholder="WASI Binary"
                  @input=${this.onBinaryInput}
                />
                <input
                  type="text"
                  placeholder="args"
                  @input=${this.onArgsInput}
                  class="bg-transparent flex-grow p-3 h-full flex-shrink"
                />
                <button
                  type="button"
                  class="text-yellow px-3 flex-shrink-0"
                  @click=${() => (this.showSettings = !this.showSettings)}
                >
                  Settings
                </button>
              </div>
              <button
                type="button"
                @click=${this.onRunClick}
                class="bg-yellow text-black px-4 font-medium"
              >
                Run
              </button>
            </div>
          </div>
          <div
            class=${this.showSettings
              ? "h-64 p-3"
              : "h-64 bg-black relative p-3"}
          >
            <div
              id="terminal"
              class=${this.showSettings
                ? "hidden"
                : "h-full absolute w-full top-0 left-0"}
            ></div>
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
        <div class="flex-grow flex flex-col items-stretch">
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
                <input type="file" @input=${this.onFilesystemInput} />
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
