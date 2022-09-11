import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TailwindElement } from "../mixins/tailwind";

@customElement("playground-file")
export class PlaygroundFile extends TailwindElement {
  @property()
  file!: File;

  onInput(event: InputEvent) {
    const newName = (event.target as HTMLInputElement).value;
    this.dispatchEvent(
      new CustomEvent("file-change", {
        detail: {
          file: new File([this.file], newName, {
            type: this.file.type,
            lastModified: this.file.lastModified,
          }),
        },
        composed: true,
        bubbles: true,
      })
    );
  }

  onDelete() {
    this.dispatchEvent(
      new CustomEvent("file-delete", {
        detail: {
          file: this.file,
        },
        composed: true,
        bubbles: true,
      })
    );
  }

  render() {
    return html`
      <div class="flex justify-between gap-2">
        <input
          type="text"
          .value=${this.file.name}
          @input=${this.onInput}
          class="bg-transparent flex-grow"
        />
        <a
          href=${URL.createObjectURL(this.file)}
          class="text-yellow"
          download=${this.file.name}
          >Download</a
        >
        <button @click=${this.onDelete} class="text-pink">Delete</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "playground-file": PlaygroundFile;
  }
}
