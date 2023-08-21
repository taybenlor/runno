import { resolve } from "path";
import { globSync } from "glob";
import { defineConfig } from "vite";

const crossOriginPolicy = {
  name: "configure-server",

  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });
  },
};

export default defineConfig({
  server: {
    port: 4321,
  },
  plugins: [crossOriginPolicy],
  build: {
    rollupOptions: {
      input: [
        resolve(__dirname, "index.html"),
        ...globSync(`${__dirname}/docs/**/*.html`),
      ],
    },
  },
});
