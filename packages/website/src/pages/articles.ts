import { html } from "lit";
import { customElement } from "lit/decorators.js";

import { TailwindElement } from "../lib/tailwind";

import wasiArticleMarkdown from "./articles/wasi.md?raw";
import ffmpegArticleMarkdown from "./articles/ffmpeg.md?raw";
import wasiWebComponentArticleMarkdown from "./articles/wasi-web-component.md?raw";
import experimentDockerMarkdown from "./articles/experiment-docker.md?raw";
import sandboxPythonMarkdown from "./articles/sandbox-python.md?raw";
import webComponentMarkdown from "./articles/web-component.md?raw";

import "../components/article";
import "../components/docker-playground";

// Keep in sync with /routes.ts
const articles = [
  {
    slug: "web-component",
    title: "The Web Component for Code",
    description: `Since I released Runno a few years ago, Web Components have become a lot more
popular. I thought it was time to re-introduce Runno, the Web
Component for Code. In this article I show how to use it with some demos.`,
    markdown: webComponentMarkdown,
    published: new Date("2025-03-30"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "sandbox-python",
    title: "I made a Python package for sandboxing code",
    description: `Over the holidays I made a version of the Runno sandbox for Python, and released it to PyPI. This was a bit of a spicy endeavour because Runno is written in TypeScript and works inside the browser.`,
    markdown: sandboxPythonMarkdown,
    published: new Date("2025-01-25"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "experiment-docker",
    title: "Experimental Docker WASI Images",
    markdown: experimentDockerMarkdown,
    published: new Date("2023-09-10"),
    draft: true,
    author: "Ben Taylor",
  },
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
      <website-route
        route="^/articles/$"
        .meta=${{ title: "Runno - Articles" }}
      >
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
          <website-route
            route=${`^/articles/${article.slug}/\$`}
            .meta=${{
              title: `Runno - ${article.title}`,
              description: article.description,
              url: `https://runno.dev/articles/${article.slug}`,
              image: "",
            }}
          >
            <website-article
              slug="${article.slug}"
              .title=${article.title}
              .markdown=${article.markdown}
              .draft=${article.draft}
              .published=${article.published}
              .author=${article.author}
            ></website-article>
          </website-route>
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
