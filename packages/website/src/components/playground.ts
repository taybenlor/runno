import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, query, state } from "lit/decorators.js";

import xtermcss from "xterm/css/xterm.css";
import { Terminal } from "xterm";
import { WebLinksAddon } from "xterm-addon-web-links";
import { FitAddon } from "xterm-addon-fit";

import { WASI, WASIContext, WASIFS } from "@runno/wasi-motor";

import { Tailwind, TailwindElement } from "../mixins/tailwind";

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
  stdout: string = "";

  @state()
  stderr: string = "";

  @state()
  files: File[] = [];

  @query("#terminal")
  _terminalElement!: HTMLDivElement;

  terminal: Terminal = new Terminal();

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

    this.stderr = "";
    this.stdout = "";

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

    const result = await WASI.start(
      fetch(URL.createObjectURL(this.binary)),
      new WASIContext({
        args: [this.binary.name, ...this.args],
        stdout: (out) => this.terminal.write(out),
        stderr: (err) => this.terminal.write(err), // TODO: Different colour?
        stdin: () => prompt("stdin (cancel to end stdin):"),
        fs,
      })
    );

    this.stdout += `\nReturn: ${result.exitCode}`;

    const newFiles: File[] = [];
    for (const [path, wasiFile] of Object.entries(result.fs)) {
      newFiles.push(
        new File([wasiFile.content], path, {
          lastModified: wasiFile.timestamps.modification.getTime(),
        })
      );
    }
    this.files = newFiles;
  }

  onFilesystemInput(event: InputEvent) {
    const inputElement = event.target as HTMLInputElement;
    const files = inputElement.files;
    if (!files) {
      return;
    }

    this.files = [...this.files, ...Array.from(files)];
    inputElement.files = null;
    inputElement.value = "";
  }

  onUpdateFile(i: number, event: CustomEvent) {
    this.files[i] = event.detail.file;
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
      <div
        class="flex flex-col flex-grow w-full mb-8 lg:w-auto lg:mr-8 lg:mb-0"
      >
        <div class="relative border border-yellow">
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
          <div class="flex justify-between">
            <div class="flex-grow flex items-center gap-2 pl-3">
              $
              <input
                id="binary"
                type="file"
                placeholder="WASI Binary"
                @input=${this.onBinaryInput}
              />
              <input
                type="text"
                placeholder="args"
                @input=${this.onArgsInput}
                class="bg-transparent flex-grow p-3 h-full"
              />
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
          id="terminal"
          class="border border-t-0 border-yellow h-64 p-3"
        ></div>
      </div>
      <div class="flex-grow flex flex-col items-stretch w-1/3 h-80 lg:h-auto">
        <div class="relative border border-yellow">
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
          <div class="p-3 flex flex-col">
            <input id="binary" type="file" @input=${this.onFilesystemInput} />
            ${this.files.map(
              (f, i) =>
                html`
                  <playground-file
                    .file=${f}
                    @file-change=${(event: CustomEvent) =>
                      this.onUpdateFile(i, event)}
                    class="my-3"
                  ></playground-file>
                `
            )}
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
