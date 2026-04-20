// vite.config.js
import typescript from "@rollup/plugin-typescript";
import { resolve } from "path";
import { defineConfig } from "vite";

// NOTE (Slice 4): WASIXWorkerHost will need COOP/COEP headers on the dev
// server so SharedArrayBuffer/Atomics are available. Set
// `server.headers['Cross-Origin-Opener-Policy']   = 'same-origin'` and
// `server.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'` when the
// worker lands. Slice 1 does not exercise threads, so headers stay off here.

export default defineConfig({
  build: {
    copyPublicDir: false, // Public dir contains testing binaries
    lib: {
      formats: ["es"],
      entry: resolve(__dirname, "lib/main.ts"),
      fileName: "lib/main",
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
  },
  plugins: [
    {
      ...typescript({ outDir: "dist", exclude: ["src"] }),
      apply: "build",
    },
  ],
});
