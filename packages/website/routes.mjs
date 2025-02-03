// Path: packages/website/src/pages/articles.ts
export const ARTICLES = [
  {
    slug: "sandbox-python",
    title: "I made a Python package for sandboxing code",
    description: `Over the holidays I made a version of the Runno sandbox for Python, and released it to PyPI. This was a bit of a spicy endeavour because Runno is written in TypeScript and works inside the browser.`,
    published: new Date("2024-01-25"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "experiment-docker",
    title: "Experimental Docker WASI Images",
    published: new Date("2023-09-10"),
    draft: true,
    author: "Ben Taylor",
  },
  {
    slug: "wasi-web-component",
    title: "Running WASI binaries from your HTML using Web Components",
    published: new Date("2023-08-27"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "ffmpeg",
    title:
      "I built a WASI playground and you can run FFmpeg in it, which is cool",
    published: new Date("2022-10-05"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "implementing-wasi",
    title: "Just implementing the whole WASI standard",
    published: new Date("3022-10-01"),
    draft: true,
    author: "Ben Taylor",
  },
];

export const ROUTES = [
  {
    path: "/index.html",
    meta: {
      title: "Runno",
      description:
        "An open-source sandbox that runs inside and outside the browser.",
      url: "https://runno.dev",
      image: "/images/social-media.png",
    },
  },
  {
    path: "/docs/index.html",
    meta: {
      title: "Runno - Docs",
    },
  },
  {
    path: "/wasi/index.html",
    meta: {
      title: "Runno - WASI",
      description:
        "Run WebAssembly made for outside the browser, inside the browser.",
    },
  },
  {
    path: "/articles/index.html",
    meta: {
      title: "Runno - Articles",
    },
  },
  ...ARTICLES.map((article) => ({
    path: `/articles/${article.slug}/index.html`,
    meta: {
      title: `Runno Article - ${article.title}`,
      description: article.description ?? "",
      url: `https://runno.dev/articles/${article.slug}`,
      image: "",
    },
  })),
];
