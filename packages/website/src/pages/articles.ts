import { html } from "lit";
import { customElement } from "lit/decorators.js";

import { TailwindElement } from "../lib/tailwind";

import wasiArticleMarkdown from "./articles/wasi.md?raw";
import ffmpegArticleMarkdown from "./articles/ffmpeg.md?raw";

import "../components/article";

const articles = [
  {
    slug: "ffmpeg",
    title: "Running FFMPEG in your browser using the Runno WASI Playground",
    markdown: ffmpegArticleMarkdown,
    published: new Date("2022-10-05"),
    draft: true,
  },
  {
    slug: "implementing-wasi",
    title: "Just implementing the whole WASI standard",
    markdown: wasiArticleMarkdown,
    published: new Date("3022-10-01"),
    draft: true,
  },
];

@customElement("page-articles")
export class PageArticles extends TailwindElement {
  render() {
    return html`
      <website-header></website-header>
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
