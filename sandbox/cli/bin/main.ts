#!/usr/bin/env node

import { WASIFS } from "@runno/wasi";
import { readAll } from "@std/io";

import { runFS } from "../lib/runtime.ts";
import { Command } from "@cliffy/command";
import { Runtime } from "../lib/types.ts";
import { fetchWASIFS } from "../lib/main.ts";
import { extractTarGz } from "../lib/tar.ts";

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
Entry name is the name of the entrypoint in the base filesystem.
`
  )
  .arguments("<runtime:string> <entry-path:string>")
  .option(
    "-f, --filesystem <filesystem:string>",
    "A tgz file to use as the base filesystem"
  )
  .option(
    "-fs, --filesystem-stdin",
    "Read the base filesystem from stdin as a tgz file (useful for piping)"
  )
  .option(
    "-es, --entry-stdin",
    "Read just the entry file from stdin (useful for piping)"
  )
  .action(
    async (
      options: {
        filesystem?: string;
        filesystemStdin?: true;
        entryStdin?: true;
      },
      ...args: [string, string]
    ) => {
      const [runtimeString, entry] = args;
      if (!isRuntime(runtimeString)) {
        throw new Error(`Unsupported runtime: ${runtimeString}`);
      }
      const runtime: Runtime = runtimeString;

      // TODO: Read the entry file from stdin

      const entryPath = entry.startsWith("/") ? entry : `/${entry}`;
      let fs: WASIFS = {};

      if (options.filesystem) {
        const baseFS = await fetchWASIFS(options.filesystem);
        fs = { ...baseFS, ...fs };
      }

      if (options.filesystemStdin) {
        const tgz = await readAll(Deno.stdin);
        const baseFS = await extractTarGz(tgz);
        fs = { ...baseFS, ...fs };
      }

      if (options.entryStdin) {
        const content = await readAll(Deno.stdin);
        fs[entryPath] = {
          path: entryPath,
          content,
          mode: "binary",
          timestamps: {
            access: new Date(),
            modification: new Date(),
            change: new Date(),
          },
        };
      }

      const result = await runFS(runtime, entryPath, fs);

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
