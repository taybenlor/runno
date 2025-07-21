// Path: packages/website/src/pages/articles.ts
export const ARTICLES = [
  {
    slug: "mcp",
    title:
      "MCP Servers are surprisingly easy. I made one that runs code in a sandbox.",
    description: `It lets LLMs run code in a safe environment, using the Runno sandbox, and it was surprisingly easy to build. I'll show you how in here.`,
    published: new Date("2025-07-21"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "sandbox",
    title: "Introducing @runno/sandbox: A WebAssembly Sandbox for Running Code",
    description: `The Runno sandbox gives you a secure WebAssembly-based sandbox for running code in various programming languages. It works in Node.js and other JavaScript runtimes, providing protection when running potentially risky code.`,
    published: new Date("2025-05-20"),
    draft: false,
    author: "Ben Taylor",
  },
  {
    slug: "web-component",
    title: "Runno: The Web Component for Code",
    description: `Since I released Runno a few years ago, Web Components have become a lot more
popular. I thought it was time to re-introduce Runno, the Web
Component for Code. In this article I show how to use it with some demos.`,
    published: new Date("2025-03-30"),
    draft: false,
    author: "Ben Taylor",
  },
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
      title: `Runno - ${article.title}`,
      description: article.description ?? "",
      url: `https://runno.dev/articles/${article.slug}`,
      image: "",
    },
  })),
];
