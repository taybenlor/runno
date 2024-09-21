import typescript from "@rollup/plugin-typescript";
import { resolve } from "path";

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
  build: {
    copyPublicDir: false, // Public dir contains testing binaries
    lib: {
      entry: resolve(__dirname, "lib/main.ts"),
      name: "Runtime",
      fileName: "runtime",
    },
    sourcemap: true,
  },
  rollupOptions: {
    // make sure to externalize deps that shouldn't be bundled
    // into your library
    external: [],
    output: {
      // Provide global variables to use in the UMD build
      // for externalized deps
      globals: {},
    },
  },
  plugins: [
    {
      ...typescript({ outDir: "dist" }),
      apply: "build",
    },
    crossOriginPolicy,
  ],
});
