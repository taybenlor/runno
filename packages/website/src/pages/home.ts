import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { Runtime, generateEmbedURL, generateEmbedHTML } from "@runno/host";

import { Tailwind } from "../mixins/tailwind";
import { exampleForRuntime } from "../examples";

import "../components/starfield";

// TODO: Port to Lit
// const codeText = document.getElementById("code") as HTMLTextAreaElement;
// const runtimeSelect = document.getElementById(
//   "runtime-select"
// ) as HTMLSelectElement;
// const editorCheckbox = document.getElementById(
//   "editor-checkbox"
// ) as HTMLInputElement;
// const autorunCheckbox = document.getElementById(
//   "autorun-checkbox"
// ) as HTMLInputElement;
// const embedText = document.getElementById("embed") as HTMLTextAreaElement;
// const runtimeIframe = document.getElementById("runtime") as HTMLIFrameElement;

// let lastRuntime = runtimeSelect.value;
// function updateState() {
//   if (
//     codeText.value.trim() == exampleForRuntime(lastRuntime as Runtime).trim()
//   ) {
//     codeText.value = exampleForRuntime(runtimeSelect.value as Runtime);
//   }

//   const embedURL = generateEmbedURL(codeText.value, runtimeSelect.value, {
//     showEditor: editorCheckbox.checked,
//     autorun: autorunCheckbox.checked,
//     baseUrl: import.meta.env.VITE_RUNTIME,
//   });
//   embedText.value = generateEmbedHTML(embedURL);
//   runtimeIframe.src = embedURL.toString();
//   lastRuntime = runtimeSelect.value;
// }

// codeText.addEventListener("input", updateState);
// runtimeSelect.addEventListener("input", updateState);
// editorCheckbox.addEventListener("input", updateState);
// autorunCheckbox.addEventListener("input", updateState);

// updateState();

@customElement("page-home")
export class PageHome extends Tailwind(LitElement) {
  static styles = css`
    .bg-sunset {
      background: linear-gradient(0deg, #030052, #06004f 70%, #330b24);
    }
  `;
  render() {
    return html`
      <div class="bg-sunset pb-8 relative">
        <website-starfield class="pointer-events-none">
          <img src="images/star.svg" />
        </website-starfield>
        <header class="py-4">
          <a href="/" title="Runno" class="absolute">
            <h1 class="text-lg">
              <img src="images/logo.svg" alt="Runno" class="sm:inline-block" />
              <span
                class="
                  inline-block
                  text-yellow
                  font-mono
                  text-xs text-center
                  border border-yellow
                  p-2
                  mt-4
                  ml-4
                  sm:mt-0
                "
              >
                v<runno-version>0.0.0</runno-version> - beta as heck
              </span>
            </h1>
          </a>
          <nav
            class="
              font-sans
              container
              mx-auto
              flex
              justify-end
              z-10
              pr-4
              sm:pr-0
            "
          >
            <a
              target="_blank"
              href="https://github.com/taybenlor/runno"
              class="inline-flex font-medium hover:text-yellow group"
            >
              <img
                src="images/github-light.png"
                class="w-6 h-6 mr-2 block group-hover:hidden"
              />
              <img
                src="images/github-yellow.png"
                class="w-6 h-6 mr-2 hidden group-hover:block"
              />
              GitHub
            </a>
          </nav>
        </header>

        <img class="absolute bottom-0 right-0" src="images/sun.svg" />
        <div class="container mx-auto relative p-4 sm:p-0">
          <h1
            class="
              text-3xl
              sm:text-4xl
              md:text-5xl
              font-bold
              text-center
              mt-10
              mb-8
            "
          >
            Make your code samples Runno.
          </h1>
          <div class="w-1/3 mx-auto">
            <hr class="border-t border-yellow my-2 h-0" />
            <hr class="w-4/5 border-t border-yellow my-2 h-0 mx-auto" />
            <hr class="w-3/5 border-t border-yellow my-2 h-0 mx-auto" />
            <hr class="w-2/5 border-t border-yellow my-2 h-0 mx-auto" />
          </div>

          <div class="flex flex-wrap items-stretch py-16 font-mono">
            <form
              class="
                flex flex-col flex-grow
                w-full
                mb-8
                lg:w-auto lg:mr-8 lg:mb-0
              "
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
                >
print("Hello, World!")
name = input("What's your name? ")
print(f"G'day {name}, welcome to Runno.")
</textarea
                >
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
                  <select id="runtime-select" class="bg-navy">
                    <option value="python" selected default>
                      Python (CPython)
                    </option>
                    <option value="ruby">Ruby (Ruby)</option>
                    <option value="quickjs">JavaScript (QuickJS)</option>
                    <option value="sqlite">SQL (SQLite)</option>
                    <option value="clang">C (clang)</option>
                    <option value="clangpp">C++ (clang)</option>
                  </select>
                </label>

                <fieldset>
                  <label class="mr-4">
                    <input id="autorun-checkbox" type="checkbox" />
                    Autorun
                  </label>

                  <label>
                    <input id="editor-checkbox" type="checkbox" checked />
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
                <textarea class="w-full h-32 p-2 bg-navy" id="embed">
                </textarea>
              </div>
            </form>

            <div
              class="flex-grow flex flex-col items-stretch w-1/3 h-80 lg:h-auto"
            >
              <div class="bg-lightBlue py-2 text-center relative">
                <span class="absolute left-4">
                  <span
                    class="rounded-full bg-navy w-3 h-3 inline-block"
                  ></span>
                  <span
                    class="rounded-full bg-navy w-3 h-3 inline-block"
                  ></span>
                  <span
                    class="rounded-full bg-navy w-3 h-3 inline-block"
                  ></span>
                </span>
                <label class="bg-navy py-1 px-8 text-yellow text-sm">
                  Preview
                </label>
              </div>
              <iframe
                crossorigin
                allow="cross-origin-isolated"
                id="runtime"
                class="flex-grow"
              ></iframe>
            </div>
          </div>
        </div>
      </div>

      <div class="relative">
        <img class="absolute top-0 right-0" src="images/sun-reflection.svg" />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-home": PageHome;
  }
}
