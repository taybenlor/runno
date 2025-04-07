import { WASIFS } from "@runno/wasi";
import type { Runtime } from "./types.ts";
import { assertUnreachable } from "./helpers.ts";

type CommandSource =
  | {
      binaryURL: string;
    }
  | {
      fsPath: string;
    };

export type Command = CommandSource & {
  binaryName: string;
  args?: string[];
  env?: { [key: string]: string };
  baseFSURL?: string; // Base FileSystem URL (.tar.gz)
};

export type RuntimeCommands = {
  prepare?: Array<Command>;
  run: Command;
};

export function commandsForRuntime(
  name: Runtime,
  entryPath: string
): RuntimeCommands {
  switch (name) {
    // Python from VMWare https://github.com/vmware-labs/webassembly-language-runtimes
    case "python":
      return {
        run: {
          binaryURL: import.meta.resolve(`../langs/python-3.11.3.wasm`),
          binaryName: "python",
          args: [entryPath],
          env: {},
          baseFSURL: import.meta.resolve(`../langs/python-3.11.3.tar.gz`),
        },
      };

    // Ruby from VMWare https://github.com/vmware-labs/webassembly-language-runtimes
    case "ruby":
      return {
        run: {
          binaryURL: import.meta.resolve(`../langs/ruby-3.2.0.wasm`),
          binaryName: "ruby",
          args: ["-r", "/ruby-3.2.0/.rubyopts.rb", entryPath],
          env: {},
          baseFSURL: import.meta.resolve(`../langs/ruby-3.2.0.tar.gz`),
        },
      };

    // QuickJS from wasmedge https://github.com/second-state/wasmedge-quickjs
    case "quickjs":
      return {
        run: {
          binaryURL: import.meta.resolve(`../langs/wasmedge_quickjs.wasm`),
          binaryName: "quickjs",
          args: [entryPath],
          env: {},
        },
      };

    // SQLite from WAPM https://wapm.io/sqlite/sqlite
    case "sqlite":
      return {
        run: {
          binaryURL: import.meta.resolve(`../langs/sqlite.wasm`),
          binaryName: "sqlite",
          args: ["-cmd", `.read ${entryPath}`],
          env: {},
        },
      };

    case "php-cgi":
      return {
        run: {
          binaryURL: import.meta.resolve(`../langs/php-cgi-8.2.0.wasm`),
          binaryName: "php",
          args: [entryPath],
          env: {},
        },
      };

    // Clang by binji https://github.com/binji/wasm-clang
    case "clang":
      return {
        prepare: [
          {
            binaryURL: import.meta.resolve(`../langs/clang.wasm`),
            binaryName: "clang",
            args: [
              "-cc1",
              "-Werror",
              "-triple",
              "wasm32-unkown-wasi",
              "-isysroot",
              "/sys",
              "-internal-isystem",
              "/sys/include",
              "-internal-isystem",
              "/sys/lib/clang/8.0.1/include",
              "-ferror-limit",
              "4",
              "-fmessage-length",
              "80",
              "-fcolor-diagnostics",
              "-O2",
              "-emit-obj",
              "-o",
              "/program.o",
              entryPath,
            ],
            env: {},
            baseFSURL: import.meta.resolve(`../langs/clang-fs.tar.gz`),
          },
          {
            binaryURL: import.meta.resolve(`../langs/wasm-ld.wasm`),
            binaryName: "wasm-ld",
            args: [
              "--no-threads",
              "--export-dynamic",
              "-z",
              "stack-size=1048576",
              "-L/sys/lib/wasm32-wasi",
              "/sys/lib/wasm32-wasi/crt1.o",
              "/program.o",
              "-lc",
              "-o",
              "/program.wasm",
            ],
            env: {},
          },
        ],
        run: {
          fsPath: "/program.wasm",
          binaryName: "program",
        },
      };

    case "clangpp":
      return {
        prepare: [
          {
            binaryURL: import.meta.resolve(`../langs/clang.wasm`),
            binaryName: "clang",
            args: [
              "-cc1",
              "-Werror",
              "-emit-obj",
              "-disable-free",
              "-isysroot",
              "/sys",
              "-internal-isystem",
              "/sys/include/c++/v1",
              "-internal-isystem",
              "/sys/include",
              "-internal-isystem",
              "/sys/lib/clang/8.0.1/include",
              "-ferror-limit",
              "4",
              "-fmessage-length",
              "80",
              "-fcolor-diagnostics",
              "-O2",
              "-o",
              "/program.o",
              "-x",
              "c++",
              entryPath,
            ],
            env: {},
            baseFSURL: import.meta.resolve(`../langs/clang-fs.tar.gz`),
          },
          {
            binaryURL: import.meta.resolve(`../langs/wasm-ld.wasm`),
            binaryName: "wasm-ld",
            args: [
              "--no-threads",
              "--export-dynamic",
              "-z",
              "stack-size=1048576",
              "-L/sys/lib/wasm32-wasi",
              "/sys/lib/wasm32-wasi/crt1.o",
              "/program.o",
              "-lc",
              "-lc++",
              "-lc++abi",
              "-o",
              "/program.wasm",
            ],
            env: {},
          },
        ],
        run: {
          fsPath: "/program.wasm",
          binaryName: "program",
        },
      };

    default:
      assertUnreachable(name, `Unknown runtime (${name}).`);
  }
}

export function getBinaryPathFromCommand(command: Command, fs: WASIFS) {
  if ("binaryURL" in command) {
    return command.binaryURL;
  } else if ("fsPath" in command) {
    const file = fs[command.fsPath];
    if (!file) {
      throw new Error("FSPath pointed to missing file");
    }

    if (file.mode === "binary") {
      const blob = new Blob([file.content], { type: "application/wasm" });
      return URL.createObjectURL(blob);
    } else {
      throw new Error("Can't create WASM blob from string");
    }
  }

  throw new Error("Could not extract binary path from command");
}
