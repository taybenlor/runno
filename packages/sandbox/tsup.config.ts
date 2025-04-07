// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["lib/main.ts"],
  format: ["esm", "cjs"],
  dts: true, // generate .d.ts files
  splitting: false,
  sourcemap: true,
  clean: true,
});
