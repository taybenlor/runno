import { WASIFS } from "@runno/wasi-motor";

type CommandSource =
  | {
      binaryURL: `${string}.wasm`;
    }
  | {
      fsPath: string;
    };

export type Command = CommandSource & {
  binaryName: string;
  args?: string[];
  env?: { [key: string]: string };
  baseFSURL?: `${string}.tar.gz`; // Base FileSystem URL (.tar.gz)
};

export type RuntimeCommands = {
  prepare?: Array<Command>;
  run: Command;
};

// TODO: Fix the way this integrates locally
// const baseURL = `${import.meta.env.VITE_HOST}/langs`;
const baseURL = `http://localhost:4321/langs`;

export function commandsForRuntime(
  name: string,
  entryPath: string
): RuntimeCommands {
  if (name === "python") {
    return {
      run: {
        binaryURL: `${baseURL}/python-3.11.3.wasm`,
        binaryName: "python",
        args: [entryPath],
        env: {},
        baseFSURL: `${baseURL}/python-3.11.3.tar.gz`,
      },
    };
  }

  if (name === "ruby") {
    return {
      run: {
        binaryURL: `${baseURL}/ruby-3.2.0.wasm`,
        binaryName: "ruby",
        args: ["-r", "/ruby-3.2.0/.rubyopts.rb", entryPath],
        env: {},
        baseFSURL: `${baseURL}/ruby-3.2.0.tar.gz`,
      },
    };
  }

  if (name === "quickjs") {
    return {
      run: {
        binaryURL: `${baseURL}/quickjs.wasi.wasm`,
        binaryName: "quickjs",
        args: ["--std", entryPath],
        env: {},
      },
    };
  }

  // TODO: Find another compiled Sqlite binary
  // if (name === "sqlite") {
  //   return { run: `cat ${entryPath} | sqlite` };
  // }

  //
  // Clang based off work by binji https://github.com/binji/wasm-clang
  //

  if (name === "clang") {
    return {
      prepare: [
        {
          binaryURL: `${baseURL}/clang.wasm`,
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
          baseFSURL: `${baseURL}/clang-fs.tar.gz`,
        },
        {
          binaryURL: `${baseURL}/wasm-ld.wasm`,
          binaryName: "ld",
          args: [
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
  }

  if (name === "clangpp") {
    return {
      prepare: [
        {
          binaryURL: `${baseURL}/clang.wasm`,
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
          baseFSURL: `${baseURL}/clang-fs.tar.gz`,
        },
        {
          binaryURL: `${baseURL}/wasm-ld.wasm`,
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
  }

  throw new Error(`Unknown runtime ${name}`);
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
