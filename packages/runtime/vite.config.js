import typescript from "@rollup/plugin-typescript";
import { resolve } from "path";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "@runno/runtime",
    },
  },
  plugins: [
    {
      ...typescript({ outDir: "dist" }),
      apply: "build",
    },
  ],
});
