import { html } from "lit";
import { customElement } from "lit/decorators.js";

import { TailwindElement } from "../lib/tailwind";

import wasiArticleMarkdown from "./articles/wasi.md?raw";
import ffmpegArticleMarkdown from "./articles/ffmpeg.md?raw";
import wasiWebComponentArticleMarkdown from "./articles/wasi-web-component.md?raw";

import "../components/article";

const articles = [
  {
    slug: "wasi-web-component",
    title: "Running WASI binaries from your HTML using Web Components",
    markdown: wasiWebComponentArticleMarkdown,
    published: new Date("2023-08-27"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "ffmpeg",
    title:
      "I built a WASI playground and you can run FFmpeg in it, which is cool",
    markdown: ffmpegArticleMarkdown,
    published: new Date("2022-10-05"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "implementing-wasi",
    title: "Just implementing the whole WASI standard",
    markdown: wasiArticleMarkdown,
    published: new Date("3022-10-01"),
    draft: true,
    author: "Ben Taylor",
  },
];

@customElement("page-articles")
export class PageArticles extends TailwindElement {
  render() {
    return html`
      <div class="bg-navy text-white pb-3">
        <website-header></website-header>
      </div>
      <website-route route="^/articles$">
        <div class="prose mx-auto my-12">
          <h1>Articles</h1>
          ${articles.map((article) => {
            if (article.draft && !import.meta.env.DEV) {
              return null;
            }
            return html`
              <p>
                <timestamp>${article.published.toDateString()}</timestamp>
                <a href=${`/articles/${article.slug}`}>${article.title}</a>
              </p>
            `;
          })}
        </div>
      </website-route>
      ${articles.map(
        (article) => html`
          <website-article
            slug="${article.slug}"
            .markdown=${article.markdown}
            .draft=${article.draft}
            .published=${article.published}
            .author=${article.author}
          ></website-article>
        `
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "page-articles": PageArticles;
  }
}
