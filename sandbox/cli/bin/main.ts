#!/usr/bin/env node

import { WASIFS, WASIPath, WASITimestamps } from "@runno/wasi";
import { readAll } from "@std/io";

import { runFS } from "../lib/runtime.ts";
import { Command } from "@cliffy/command";
import {
  CompleteResult,
  CrashResult,
  Runtime,
  TerminatedResult,
  TimeoutResult,
} from "../lib/types.ts";
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
Entry path is the path of the entrypoint in the base filesystem.
`
  )
  .arguments("<runtime:string> [entry-path:string]")
  .option(
    "-f, --filesystem <filesystem:string>",
    "A tgz file to use as the base filesystem"
  )
  .option(
    "-t --timeout <timeout:number>",
    "The maximum amount of time to allow the code to run (in seconds)"
  )
  .option(
    "--filesystem-stdin",
    "Read the base filesystem from stdin as a tgz file (useful for piping)"
  )
  .option(
    "--entry-stdin",
    "Read just the entry file from stdin (useful for piping)"
  )
  .option("--json", "Output the result as JSON (useful for scripting)")
  .action(
    async (
      options: {
        filesystem?: string;
        filesystemStdin?: true;
        entryStdin?: true;
        json?: true;
        timeout?: number;
      },
      ...args: [string, string | undefined]
    ) => {
      let [runtimeString, entry] = args;
      if (!isRuntime(runtimeString)) {
        throw new Error(`Unsupported runtime: ${runtimeString}`);
      }
      const runtime: Runtime = runtimeString;

      entry = entry ?? "/program";
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

      const result = await runFS(runtime, entryPath, fs, {
        timeout: options.timeout,
      });
      if (options.json) {
        let jsonResult: JSONResult;
        if (result.resultType === "complete") {
          jsonResult = {
            ...result,
            fs: fsToBase64FS(result.fs),
          } as Omit<CompleteResult, "fs"> & { fs: Base64WASIFS };
        } else {
          jsonResult = result;
        }
        console.log(JSON.stringify(jsonResult));
        return;
      }

      switch (result.resultType) {
        case "complete":
          console.error(result.stderr);
          console.log(result.stdout);
          break;
        case "timeout":
          console.error("Timeout");
          Deno.exit(1);
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

function fsToBase64FS(fs: WASIFS): Base64WASIFS {
  return Object.fromEntries(
    Object.entries(fs).map(([path, file]) => {
      if (file.mode === "binary") {
        return [
          path,
          {
            ...file,
            mode: "base64",
            content: btoa(
              file.content.reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ""
              )
            ),
          },
        ];
      }
      return [path, file];
    })
  );
}

export type Base64WASIFS = {
  [path: WASIPath]: Base64WASIFile | StringWASIFile;
};

export type Base64WASIFile = {
  path: WASIPath;
  timestamps: WASITimestamps;
  mode: "base64";
  content: string;
};

export type StringWASIFile = {
  path: WASIPath;
  timestamps: WASITimestamps;
  mode: "string";
  content: string;
};

export type JSONResult =
  | (Omit<CompleteResult, "fs"> & { fs: Base64WASIFS })
  | CrashResult
  | TerminatedResult
  | TimeoutResult;
