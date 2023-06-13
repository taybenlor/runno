import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TailwindElement } from "../lib/tailwind";

import { Runtime, generateEmbedURL, generateEmbedHTML } from "@runno/host";
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
  autorun: boolean = false;

  get embedURL() {
    return generateEmbedURL(this.code, this.runtime, {
      showEditor: this.showEditor,
      autorun: this.autorun,
      baseUrl: import.meta.env.VITE_RUNTIME,
    });
  }

  get embedHTML() {
    return generateEmbedHTML(this.embedURL);
  }

  dispatchInput() {
    console.log("dispatch formInput");
    this.dispatchEvent(
      new CustomEvent("form-input", {
        bubbles: true,
        composed: true,
      })
    );
  }

  onCodeInput(e: InputEvent) {
    this.code = (e.target as HTMLTextAreaElement).value;
    this.dispatchInput();
  }

  onSelectInput(e: InputEvent) {
    const newRuntime = (e.target as HTMLSelectElement).value as Runtime;
    const oldExample = exampleForRuntime(this.runtime);

    if (this.code.trim() === oldExample.trim()) {
      this.code = exampleForRuntime(newRuntime);
    }

    this.runtime = newRuntime;

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
          for="code"
        >
          Your code
        </label>
        <textarea
          spellcheck="false"
          class="w-full h-[35vh] p-2 bg-navy"
          id="code"
          .value=${this.code}
          @input=${this.onCodeInput}
        ></textarea>
      </div>
      <div
        class="
    border-l border-r border-yellow
    p-2
    px-4
    flex
    justify-between
  "
      >
        <label for="runtime-select">
          <span class="text-lightBlue">Runtime:</span>
          <select
            id="runtime-select"
            class="bg-navy"
            @input=${this.onSelectInput}
          >
            <option value="python" selected default>Python (CPython)</option>
            <option value="ruby">Ruby (Ruby)</option>
            <option value="quickjs">JavaScript (QuickJS)</option>
            <option value="php-cgi">PHP (CGI)</option>
            <option value="sqlite">SQL (SQLite)</option>
            <option value="clang">C (clang)</option>
            <option value="clangpp">C++ (clang)</option>
          </select>
        </label>

        <fieldset>
          <label class="mr-4">
            <input
              id="autorun-checkbox"
              type="checkbox"
              .checked=${this.autorun}
              @input=${this.onAutorunInput}
            />
            Autorun
          </label>

          <label>
            <input
              id="editor-checkbox"
              type="checkbox"
              .checked=${this.showEditor}
              @input=${this.onShowEditorInput}
            />
            Code editor
          </label>
        </fieldset>
      </div>
      <div class="relative border border-yellow">
        <label
          spellcheck="false"
          class="
      absolute
      -bottom-2
      left-4
      px-4
      bg-navy
      text-sm text-yellow
    "
          for="embed"
        >
          Embed this
        </label>
        <textarea
          class="w-full h-32 p-2 bg-navy"
          .value=${this.embedHTML}
        ></textarea>
      </div>
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "website-form": WebsiteForm;
  }
}
