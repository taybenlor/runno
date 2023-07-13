import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TailwindElement } from "../lib/tailwind";

import { Runtime } from "@runno/host";
import { exampleForRuntime } from "../examples";

@customElement("website-form")
export class WebsiteForm extends TailwindElement {
  @property({ type: String })
  runtime: Runtime = "python";

  @property({ type: String })
  code: string = exampleForRuntime("python");

  @property({ type: Boolean })
  showEditor: boolean = true;

  @property({ type: Boolean })
  controls: boolean = true;

  @property({ type: Boolean })
  autorun: boolean = false;

  dispatchInput() {
    this.dispatchEvent(
      new CustomEvent("form-input", {
        bubbles: true,
        composed: true,
      })
    );
  }

  onSelectInput(e: InputEvent) {
    this.runtime = (e.target as HTMLSelectElement).value as Runtime;
    this.code = exampleForRuntime(this.runtime);
    this.dispatchInput();
  }

  onControlsInput() {
    this.controls = !this.controls;
    this.dispatchInput();
  }

  onAutorunInput() {
    this.autorun = !this.autorun;
    this.dispatchInput();
  }

  onShowEditorInput() {
    this.showEditor = !this.showEditor;
    this.dispatchInput();
  }

  render() {
    return html`<form
      class="flex flex-col flex-grow rounded-lg font-mono text-white bg-black drop-shadow-2xl shadow-2xl"
    >
      <div class="relative">
        <pre
          class="py-3 px-4 whitespace-pre-wrap text-sm"
        ><code>&lt;runno-run runtime=<select
  id="runtime-select"
  class="bg-black border border-yellow py-1 px-2 rounded whitespace-nowrap"
  @input=${this.onSelectInput}
>
  <option value="python" selected default>"python"</option>
  <option value="ruby">"ruby"</option>
  <option value="quickjs">"quickjs"</option>
  <option value="php-cgi">"php-cgi"</option>
  <option value="sqlite">"sqlite"</option>
  <option value="clang">"clang"</option>
  <option value="clangpp">"clangpp"</option>
</select> <label class="ml-2 whitespace-nowrap"><input
              id="controls-checkbox"
              class="mr-1"
              type="checkbox"
              .checked=${this.controls}
              @input=${this.onControlsInput}
            />controls</label> <label class="ml-2 whitespace-nowrap"><input
              id="editor-checkbox"
              class="mr-1"
              type="checkbox"
              .checked=${this.showEditor}
              @input=${this.onShowEditorInput}
            />editor</label> <label class="ml-2 whitespace-nowrap"><input
              id="autorun-checkbox"
              class="mr-1"
              type="checkbox"
              .checked=${this.autorun}
              @input=${this.onAutorunInput}
            />autorun</label>&gt;${"\n"}${this.code}${"\n"}&lt;/runno-run&gt;
</code></pre>
      </div>
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "website-form": WebsiteForm;
  }
}
