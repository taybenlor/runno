import typescript from "@rollup/plugin-typescript";

export default {
  build: {
    lib: {
      entry: "src/main.ts",
      name: "@runno/runtime",
    },
  },
  plugins: [
    {
      ...typescript({ outDir: "dist" }),
      apply: "build",
    },
  ],
};
