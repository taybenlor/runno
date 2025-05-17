// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "lib/main.ts",
    worker: "lib/worker.ts",
  },
  format: ["esm"],
  experimentalDts: true, // generate .d.ts files
  sourcemap: true,
  clean: true,
});
