// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/main.ts",
  },
  format: ["esm"],
  experimentalDts: true, // generate .d.ts files
  sourcemap: true,
  clean: true,
});
