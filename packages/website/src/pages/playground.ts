import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

import { WASI, WASIContext } from "@runno/wasi-motor";

import { Tailwind } from "../mixins/tailwind";

@customElement("page-playground")
export class PagePlayground extends Tailwind(LitElement) {
  @state()
  args: string[] = [];

  @state()
  binary: File | null = null;

  @state()
  stdout: string = "";

  @state()
  stderr: string = "";

  onArgsInput(event: InputEvent) {
    this.args = (event.target as HTMLInputElement).value.split(" ");
  }

  onFileInput(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    if (!target.files) {
      return;
    }

    this.binary = target.files.item(0);
  }

  async onRunClick(event: MouseEvent) {
    if (!this.binary) {
      return;
    }

    const result = await WASI.start(
      fetch(URL.createObjectURL(this.binary)),
      new WASIContext({
        args: this.args,
        stdout: (out) => (this.stdout += out),
        stderr: (err) => (this.stderr += err),
        stdin: () => prompt("stdin (cancel to end stdin):"),
        fs: {},
      })
    );

    this.stdout += `Return: ${result.exitCode}`;
  }

  render() {
    return html`
      <website-header></website-header>
      <div class="flex flex-wrap container mx-auto my-16 relative">
        <div>
          <h2>Command</h2>
          <form>
            $
            <input
              type="file"
              placeholder="WASI Binary"
              @input=${this.onFileInput}
            />
            <input type="text" placeholder="args" @input=${this.onArgsInput} />
            <button type="button" @click=${this.onRunClick}>Run</button>
          </form>
          <pre>${this.stdout}</pre>
        </div>
        <div>
          <h2>Files</h2>
          <ul>
            <!-- TODO: list of files -->
          </ul>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-playground": PagePlayground;
  }
}
