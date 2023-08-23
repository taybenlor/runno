/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  entryPoints: ["./lib/main.ts"],
  out: "docs",
  // titleLink: "/",
  sidebarLinks: {
    Docs: "/docs",
    "@runno/wasi": "/docs/wasi/",
  },
  navigationLinks: {
    Runno: "/",
    WASI: "/wasi",
    Articles: "/articles",
    Docs: "/docs",
    GitHub: "https://github.com/taybenlor/runno",
  },
};
