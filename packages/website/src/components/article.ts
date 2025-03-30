import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { marked } from "marked";
import { TailwindElement } from "../lib/tailwind";

const slugger = new marked.Slugger();

function slugify(text: string) {
  const tempEl = document.createElement("p");
  tempEl.innerHTML = text;
  return slugger.slug(tempEl.textContent!);
}

@customElement("website-article")
export class WebsiteArticle extends TailwindElement {
  @property({ type: String })
  markdown: string = "";

  @property({ type: String })
  slug: string = "";

  @property({ type: String })
  title: string = "";

  @property({ type: Date })
  published: Date = new Date();

  @property({ type: Boolean })
  draft: boolean = false;

  @property({ type: String })
  author: string = "";

  static styles = [
    css`
      runno-wasi {
        padding: 1em;
        box-sizing: content-box;
      }
    `,
    ...TailwindElement.styles,
  ];

  onPopState = (_: PopStateEvent) => {
    const hash = window.location.hash;
    const el = this.shadowRoot?.querySelector(`${hash}`);
    if (el) {
      el.scrollIntoView();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("popstate", this.onPopState);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("popstate", this.onPopState);
  }

  render() {
    return html`
      ${this.draft
        ? html`<div
            class="container mx-auto my-16 p-8 border-2 border-pink text-pink"
          >
            <h1 class="font-bold text-3xl">
              Draft: Not ready for public consumption
            </h1>
          </div>`
        : null}
      <div class="relative">
        <img
          class="absolute top-0 right-0 hidden xl:block"
          src="/images/sun-reflection.svg"
        />
      </div>
      <div
        class="container mx-auto my-16 flex-wrap relative px-8 md:p-0 lg:flex"
      >
        <runno-scroll-highlight
          class="mb-8 p-4 text-sm w-[65ch] md:text-base lg:w-[28ch] sm:p-0"
        >
          <nav
            class="
          border border-lightGrey
          mr-8
          p-2
          list-none
          lg:sticky
          top-4
          columns-2
          w-full
          sm:columns-3
          lg:w-auto lg:columns-1
        "
          >
            ${marked.lexer(this.markdown).map((token) => {
              if (token.type !== "heading") {
                return null;
              }
              if (token.depth > 2) {
                return null;
              }
              return html`
                <li class=${token.depth === 1 ? "text-teal my-1" : "pl-4 my-1"}>
                  <a href="#${slugify(token.text)}"
                    >${unsafeHTML(marked.parseInline(token.text))}</a
                  >
                </li>
              `;
            })}
          </nav>
        </runno-scroll-highlight>
        <article class="prose">
          <p class="text-right text-pink">
            <time class="font-bold" datetime="${this.published.toISOString()}"
              >${this.published.toDateString()}</time
            >
            by <span class="font-bold">${this.author}</span>
          </p>

          ${unsafeHTML(replacePreWithCode(marked.parse(this.markdown)))}
        </article>
      </div>
    `;
  }
}

function replacePreWithCode(raw: string) {
  raw = raw.replaceAll(`<pre><code class="language-`, '<runno-code syntax="');
  raw = raw.replaceAll(`</code></pre>`, "</runno-code>");
  return raw;
}

declare global {
  interface HTMLElementTagNameMap {
    "website-article": WebsiteArticle;
  }
}
