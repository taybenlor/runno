import { css, html } from "lit";
import { customElement, state, query } from "lit/decorators.js";

import { Runtime } from "@runno/host";

import { TailwindElement } from "../lib/tailwind";

import { exampleForRuntime } from "../examples";
import "../components/form";

import type { WebsiteForm } from "../components/form";
import { stripWhitespace } from "@runno/runtime";

@customElement("website-demo")
export class WebsiteDemo extends TailwindElement {
  static styles = [
    TailwindElement.styles,
    css`
      runno-run {
        --runno-terminal-min-height: 8rem;
      }
    `,
  ];

  @state()
  runtime: Runtime = "python";

  @state()
  code: string = stripWhitespace(exampleForRuntime(this.runtime));

  @state()
  controls: boolean = true;

  @state()
  editor: boolean = true;

  @state()
  autorun: boolean = false;

  @query("website-form", true)
  _form!: WebsiteForm;

  onFormInput() {
    this.runtime = this._form.runtime;
    this.code = stripWhitespace(this._form.code);
    this.controls = this._form.controls;
    this.editor = this._form.showEditor;
    this.autorun = this._form.autorun;
  }

  render() {
    return html`
      <div class="container mx-auto px-4 md:px-0">
        <div
          class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch py-16 -mt-28"
        >
          <div class="w-full lg:w-auto">
            <website-form @form-input=${this.onFormInput}></website-form>
            <div class="text-black mt-8">
              <!-- "marketing" copy -->
              <slot></slot>
            </div>
          </div>
          <div class="w-full md:w-auto">
            <div
              class="w-full rounded-lg overflow-clip bg-white drop-shadow-2xl shadow-2xl"
            >
              <div
                class="flex justify-center border-b border-b-lightGrey rounded"
              >
                <span class="text-black bg-lightGrey px-8 m-2 font-mono"
                  >Preview</span
                >
              </div>
              <runno-run
                class="w-full"
                .runtime=${this.runtime}
                .code=${this.code}
                ?controls=${this.controls}
                ?editor=${this.editor}
                ?autorun=${this.autorun}
              ></runno-run>
            </div>
            <div>
              <img
                class="w-2/3 md:w-64 ml-12 mt-4"
                src="/images/browser-text.svg"
                alt="That's all in the browser!"
              />
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "website-demo": WebsiteDemo;
  }
}
