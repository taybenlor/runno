// Rollup config for the WASI Lib

import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
//import builtins from "rollup-plugin-node-builtins";
//import globals from "rollup-plugin-node-globals";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import pkg from "./package.json";

const sourcemapOption = process.env.PROD ? undefined : "inline";

// TODO: This used to be used to
//       switch between browser and node versions
//       I don't care about node and it seems to be failing
//       in an annoying way so yoink
//
// const replaceNodeOptions = {
//   delimiters: ["", ""],
//   values: {
//     "/*ROLLUP_REPLACE_NODE": "",
//     "ROLLUP_REPLACE_NODE*/": "",
//   },
// };

// const replaceBrowserOptions = {
//   delimiters: ["", ""],
//   values: {
//     "/*ROLLUP_REPLACE_BROWSER": "",
//     "ROLLUP_REPLACE_BROWSER*/": "",
//   },
// };

let typescriptPluginOptions = {
  tsconfig: "./tsconfig.json",
  exclude: ["./test/**/*"],
  sourceMap: sourcemapOption,
};

const plugins = [
  typescript(typescriptPluginOptions),
  resolve({ preferBuiltins: false }),
  commonjs(),
  json(),
  //globals(),
];

const libBundles = [
  {
    input: "./src/index.ts",
    output: {
      file: pkg.module,
      format: "esm",
      sourcemap: sourcemapOption,
    },
    watch: {
      clearScreen: false,
    },
    plugins,
  },
  {
    input: "./src/index.ts",
    output: {
      file: pkg.main,
      format: "cjs",
      sourcemap: sourcemapOption,
    },
    watch: {
      clearScreen: false,
    },
    plugins,
  },
];

export default libBundles;
