import { html, css, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";

import xtermcss from "xterm/css/xterm.css?inline";

import { TailwindElement } from "../lib/tailwind";

@customElement("website-docker-playground")
export class WebsiteDockerPlayground extends TailwindElement {
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
  _imageFile: File | null = null;

  get imageSrc(): string | null {
    if (!this._imageFile) {
      return null;
    }

    return URL.createObjectURL(this._imageFile);
  }

  //
  // Component Event Handlers
  //

  onImageInput(event: InputEvent) {
    const target = event.target as HTMLInputElement;
    if (!target.files) {
      return;
    }

    const file = target.files.item(0);
    if (!file) {
      return;
    }

    this._imageFile = new File([file], file.name, {
      type: "application/wasm", // TODO: What is oci image mime type
    });
  }

  render() {
    return html`
      <div class="bg-black text-white">
        <div class="">
          <div class="relative h-14">
            <div class="flex justify-between items-stretch h-full">
              <div class="flex-grow flex items-center gap-2 pl-3">
                <input
                  id="binary"
                  type="file"
                  placeholder="Docker Image Tar File"
                  @input=${this.onImageInput}
                />
              </div>
            </div>
          </div>
          ${this.imageSrc
            ? html`<runno-container
                src=${this.imageSrc}
                controls
              ></runno-container>`
            : html`
                <p class="h-64 p-3 monospace">
                  Please select a Docker WASI image file&hellip;
                </p>
              `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "website-docker-playground": WebsiteDockerPlayground;
  }
}
