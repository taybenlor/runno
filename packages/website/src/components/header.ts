import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { Tailwind } from "../mixins/tailwind";

@customElement("website-header")
export class WebsiteHeader extends Tailwind(LitElement) {
  render() {
    return html`
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
    gap-8
  "
        >
          <a href="/" class="inline-flex font-medium hover:text-yellow group">
            Home
          </a>
          <a
            href="/wasi"
            class="inline-flex font-medium hover:text-yellow group"
          >
            WASI
          </a>
          <a
            href="/docs"
            class="inline-flex font-medium hover:text-yellow group"
          >
            Docs
          </a>
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "website-header": WebsiteHeader;
  }
}
