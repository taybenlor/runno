// Pre-render the app into static HTML.
// run `npm run generate` and then `dist/static` can be served as a static site.
// From: https://github.com/vitejs/vite-plugin-vue/blob/main/playground/ssr-vue/prerender.js

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

import { ROUTES } from "./routes.ts";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const toAbsolute = (p) => path.resolve(__dirname, p);

const template = fs.readFileSync(toAbsolute("dist/index.html"), "utf-8");

(async () => {
  // pre-render each route...
  for (const { path: filePath, meta } of ROUTES) {
    let metaHtml = "";
    for (const [key, value] of Object.entries(meta)) {
      metaHtml += `<meta name="${key}" content="${value}">\n`;
      metaHtml += `<meta name="og:${key}" content="${value}">\n`;
    }

    const html = template.replace("<!-- prerender:meta -->", metaHtml);

    const newPath = "dist" + filePath;
    fs.mkdirSync(path.dirname(toAbsolute(newPath)), { recursive: true });
    fs.writeFileSync(toAbsolute(newPath), html);
    console.log("pre-rendered:", newPath);
  }
})();
