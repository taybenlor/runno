// vite.config.js
import typescript from "@rollup/plugin-typescript";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    copyPublicDir: false, // Public dir contains testing binaries
    lib: {
      entry: resolve(__dirname, "lib/main.ts"),
      name: "WASI",
      // the proper extensions will be added
      fileName: "wasi",
    },
    sourcemap: true,
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
      ...typescript({ outDir: "dist" }),
      apply: "build",
    },
  ],
});
