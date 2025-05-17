import { WASIFS } from "@runno/wasi";
import type { Runtime } from "./types.js";
import { assertUnreachable } from "./helpers.js";

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
          binaryURL: new URL(
            `../dist/langs/python-3.11.3.wasm`,
            import.meta.url
          ).toString(),
          binaryName: "python",
          args: [entryPath],
          env: {},
          baseFSURL: new URL(
            `../dist/langs/python-3.11.3.tar.gz`,
            import.meta.url
          ).toString(),
        },
      };

    // Ruby from VMWare https://github.com/vmware-labs/webassembly-language-runtimes
    case "ruby":
      return {
        run: {
          binaryURL: new URL(
            `../dist/langs/ruby-3.2.0.wasm`,
            import.meta.url
          ).toString(),
          binaryName: "ruby",
          args: ["-r", "/ruby-3.2.0/.rubyopts.rb", entryPath],
          env: {},
          baseFSURL: new URL(
            `../dist/langs/ruby-3.2.0.tar.gz`,
            import.meta.url
          ).toString(),
        },
      };

    // QuickJS from wasmedge https://github.com/second-state/wasmedge-quickjs
    case "quickjs":
      return {
        run: {
          binaryURL: new URL(
            `../dist/langs/wasmedge_quickjs.wasm`,
            import.meta.url
          ).toString(),
          binaryName: "quickjs",
          args: [entryPath],
          env: {},
        },
      };

    // SQLite from WAPM https://wapm.io/sqlite/sqlite
    case "sqlite":
      return {
        run: {
          binaryURL: new URL(
            `../dist/langs/sqlite.wasm`,
            import.meta.url
          ).toString(),
          binaryName: "sqlite",
          args: ["-cmd", `.read ${entryPath}`],
          env: {},
        },
      };

    case "php-cgi":
      return {
        run: {
          binaryURL: new URL(
            `../dist/langs/php-cgi-8.2.0.wasm`,
            import.meta.url
          ).toString(),
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
            binaryURL: new URL(
              `../dist/langs/clang.wasm`,
              import.meta.url
            ).toString(),
            binaryName: "clang",
            args: [
              "-cc1",
              "-Werror",
              "-triple",
              "wasm32-unknown-wasi",
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
            baseFSURL: new URL(
              `../dist/langs/clang-fs.tar.gz`,
              import.meta.url
            ).toString(),
          },
          {
            binaryURL: new URL(
              `../dist/langs/wasm-ld.wasm`,
              import.meta.url
            ).toString(),
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
            binaryURL: new URL(
              `../dist/langs/clang.wasm`,
              import.meta.url
            ).toString(),
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
            baseFSURL: new URL(
              `../dist/langs/clang-fs.tar.gz`,
              import.meta.url
            ).toString(),
          },
          {
            binaryURL: new URL(
              `../dist/langs/wasm-ld.wasm`,
              import.meta.url
            ).toString(),
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
      const base64 = Buffer.from(file.content).toString("base64");
      return `data:application/wasm;base64,${base64}`;
    } else {
      throw new Error("Can't create WASM blob from string");
    }
  }

  throw new Error("Could not extract binary path from command");
}
