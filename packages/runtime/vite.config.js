import typescript from "@rollup/plugin-typescript";

export default {
  build: {
    lib: {
      entry: "src/main.ts",
      name: "@runno/runtime",
    },
  },
  define: {
    "process.platform": JSON.stringify(null),
    "process.env.NODE_DEBUG": JSON.stringify(false),
  },
  plugins: [
    {
      ...typescript({ outDir: "dist" }),
      apply: "build",
    },
  ],
};
