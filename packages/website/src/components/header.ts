import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { TailwindElement } from "../lib/tailwind";

@customElement("website-header")
export class WebsiteHeader extends TailwindElement {
  render() {
    return html`
      <header class="py-4">
        <a href="/" title="Runno" class="absolute">
          <h1 class="text-lg">
            <img src="/images/logo.svg" alt="Runno" class="lg:inline-block" />
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
        lg:mt-0
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
    ml-auto
    mr-4
    flex
    flex-wrap
    justify-end
    z-10
    gap-8
    pr-4
    sm:pr-0
    max-w-[50%]
  "
        >
          <a href="/wasi" class="inline-flex font-bold hover:text-yellow group">
            WASI
          </a>
          <a
            href="/articles"
            class="inline-flex font-bold hover:text-yellow group"
          >
            Articles
          </a>
          <a href="/docs" class="inline-flex font-bold hover:text-yellow group">
            Docs
          </a>
          <a
            target="_blank"
            href="https://www.npmjs.com/package/@runno/runtime"
            class="inline-flex font-bold hover:text-yellow group"
          >
            <svg
              class="w-10 h-8 -mt-0.5"
              version="1.1"
              id="npm"
              xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              x="0px"
              y="0px"
              viewBox="0 0 780 250"
              style="enable-background:new 0 0 780 250;"
              xml:space="preserve"
            >
              <title>NPM</title>
              <style type="text/css">
                .st0 {
                  fill: currentColor;
                }
              </style>
              <path
                class="st0"
                d="M240,250h100v-50h100V0H240V250z M340,50h50v100h-50V50z M480,0v200h100V50h50v150h50V50h50v150h50V0H480z
	 M0,200h100V50h50v150h50V0H0V200z"
              />
            </svg>
          </a>
          <a
            target="_blank"
            href="https://github.com/taybenlor/runno"
            class="inline-flex font-bold hover:text-yellow group"
          >
            <img
              src="/images/github-light.png"
              class="w-6 h-6 mr-2 block group-hover:hidden"
            />
            <img
              src="/images/github-yellow.png"
              class="w-6 h-6 mr-2 hidden group-hover:block"
            />
            GitHub
          </a>
        </nav>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "website-header": WebsiteHeader;
  }
}
