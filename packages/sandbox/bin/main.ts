#!/usr/bin/env node

import { WASIFS } from "@runno/wasi";

import { runFS } from "../lib/runtime.ts";
import { Command } from "@cliffy/command";
import { Runtime } from "../lib/types.ts";
import { fetchWASIFS } from "../lib/main.ts";

function isRuntime(runtime: string): runtime is Runtime {
  return [
    "python",
    "ruby",
    "quickjs",
    "php-cgi",
    "clang",
    "clangpp",
    "sqlite",
  ].includes(runtime);
}

const command = new Command()
  .name("runno")
  .version("0.7.0")
  .description(
    `A CLI for running code in a sandbox environment, powered by Runno & WASI.
Supports python, ruby, quickjs, php-cgi, clang, and clangpp.
Entry is a path to a file, which will be added on top of the base filesystem and used as the entrypoint.
`
  )
  .arguments("<runtime:string> <entry:string>")
  .option(
    "-f, --filesystem <filesystem:string>",
    "A tgz file to use as the base filesystem"
  )
  .action(
    async (options: { filesystem?: string }, ...args: [string, string]) => {
      const [runtimeString, entry] = args;
      if (!isRuntime(runtimeString)) {
        throw new Error(`Unsupported runtime: ${runtimeString}`);
      }
      const runtime: Runtime = runtimeString;

      // TODO: Use filesystem helpers
      const entryName = entry.split("/").pop() ?? entry;
      let fs: WASIFS = {
        [`/${entryName}`]: {
          path: `/${entryName}`,
          content: await Deno.readFile(entry),
          mode: "binary",
          timestamps: {
            access: new Date(),
            modification: new Date(),
            change: new Date(),
          },
        },
      };

      if (options.filesystem) {
        const baseFS = fetchWASIFS(options.filesystem);
        fs = { ...baseFS, ...fs };
      }

      const result = await runFS(runtime, entryName, fs);

      switch (result.resultType) {
        case "complete":
          console.error(result.stderr);
          console.log(result.stdout);
          break;
        case "crash":
          console.error(result.error);
          Deno.exit(1);
          break;
        case "terminated":
          console.error("Terminated");
          Deno.exit(1);
          break;
      }
    }
  );

await command.parse(Deno.args);
