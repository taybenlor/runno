import { Editor } from "./editor";
import { Terminal } from "./terminal";
import {
  CommandResult,
  FS,
  Runtime,
  Syntax,
  RuntimeMethods,
} from "@runno/host";
import { WasmFs } from "./wasmfs";
import { headlessRunCommand } from "./headless";

type RuntimeCommands = {
  prepare?: Array<string>;
  run: string;
};

function commandsForRuntime(name: string, entryPath: string): RuntimeCommands {
  if (name === "python") {
    return { run: `python ${entryPath}` };
  }

  if (name === "quickjs") {
    return { run: `quickjs --std ${entryPath}` };
  }

  if (name === "sqlite") {
    return { run: `cat ${entryPath} | sqlite` };
  }

  if (name === "clang") {
    return {
      prepare: [
        `clang -cc1 -triple wasm32-unkown-wasi -isysroot /sys -internal-isystem /sys/include -ferror-limit 4 -fmessage-length 80 -fcolor-diagnostics -O2 -emit-obj -o ./program.o ${entryPath}`,
        `wasm-ld -L/sys/lib/wasm32-wasi /sys/lib/wasm32-wasi/crt1.o ./program.o -lc -o ./program.wasm`,
      ],
      run: `wasmer run ./program.wasm`,
    };
  }

  if (name === "clangpp") {
    return {
      prepare: [
        `runno-clang -cc1 -emit-obj -disable-free -isysroot /sys -internal-isystem /sys/include/c++/v1 -internal-isystem /sys/include -internal-isystem /sys/lib/clang/8.0.1/include -ferror-limit 4 -fmessage-length 80 -fcolor-diagnostics -O2 -o program.o -x c++  ${entryPath}`,
        `runno-wasm-ld --no-threads --export-dynamic -z stack-size=1048576 -L/sys/lib/wasm32-wasi /sys/lib/wasm32-wasi/crt1.o program.o -lc -lc++ -lc++abi -o ./program.wasm`,
      ],
      run: `wasmer run ./program.wasm`,
    };
  }

  throw new Error(`Unknown runtime ${name}`);
}

export class RunnoProvider implements RuntimeMethods {
  terminal: Terminal;
  editor: Editor;

  constructor(terminal: Terminal, editor: Editor) {
    this.terminal = terminal;
    this.editor = editor;

    editor.addRunCallback((runtime, code) => {
      this.interactiveRunCode(runtime, code);
    });
  }

  //
  // Public Interface
  //

  showEditor() {
    this.editor.show();
  }

  hideEditor() {
    this.editor.hide();
  }

  setEditorProgram(syntax: Syntax, runtime: Runtime, code: string) {
    this.editor.setProgram(syntax, runtime, code);
  }

  interactiveRunCode(runtime: Runtime, code: string): Promise<CommandResult> {
    return this.interactiveRunFS(runtime, "program", {
      program: { name: "program", content: code },
    });
  }

  async interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<CommandResult> {
    const commands = commandsForRuntime(runtime, entryPath);

    this.writeFS(fs);

    const prepared: {
      prepareResult?: {
        stdin: string;
        stdout: string;
        stderr: string;
        tty: string;
        fs: FS;
      };
    } = {};
    if (commands.prepare) {
      prepared.prepareResult = {
        stdin: "",
        stdout: "",
        stderr: "",
        tty: "",
        fs: {},
      };
      for (const command of commands.prepare || []) {
        const result = await this.interactiveUnsafeCommand(command, {});
        prepared.prepareResult.stdin += result.stdin;
        prepared.prepareResult.stdout += result.stdout;
        prepared.prepareResult.stderr += result.stderr;
        prepared.prepareResult.tty += result.tty;

        // It's okay not to merge here since the FS is cumulative
        // over each run.
        prepared.prepareResult.fs = result.fs;
      }
    }

    const result = await this.interactiveUnsafeCommand(commands.run, {});
    return {
      ...result,
      ...prepared,
    };
  }

  interactiveUnsafeCommand(command: string, fs: FS): Promise<CommandResult> {
    this.writeFS(fs);
    return this.terminal.runCommand(command);
  }

  writeFS(fs: FS) {
    for (const [name, file] of Object.entries(fs)) {
      this.terminal.writeFile(name, file.content);
    }
  }

  headlessRunCode(
    runtime: Runtime,
    code: string,
    stdin?: string
  ): Promise<CommandResult> {
    return this.headlessRunFS(
      runtime,
      "program",
      {
        program: { name: "program", content: code },
      },
      stdin
    );
  }

  async headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS,
    stdin?: string
  ): Promise<CommandResult> {
    const commands = commandsForRuntime(runtime, entryPath);

    const prepared: {
      prepareResult?: {
        stdin: string;
        stdout: string;
        stderr: string;
        tty: string;
        fs: FS;
      };
    } = {};

    if (commands.prepare) {
      prepared.prepareResult = {
        stdin: "",
        stdout: "",
        stderr: "",
        tty: "",
        fs: {},
      };
      for (const command of commands.prepare || []) {
        const result = await this.headlessUnsafeCommand(command, fs, stdin);
        prepared.prepareResult.stdin += result.stdin;
        prepared.prepareResult.stdout += result.stdout;
        prepared.prepareResult.stderr += result.stderr;
        prepared.prepareResult.tty += result.tty;

        // It's okay not to merge here since the FS will be cumulative
        // over each run.
        prepared.prepareResult.fs = result.fs;
        fs = result.fs;
      }
    }

    const result = await this.headlessUnsafeCommand(commands.run, fs, stdin);
    return {
      ...result,
      ...prepared,
    };
  }

  async headlessUnsafeCommand(
    command: string,
    fs: FS,
    stdin?: string
  ): Promise<CommandResult> {
    const wasmfs = new WasmFs();
    const jsonFs: { [name: string]: string | Uint8Array } = {
      "/dev/stdin": "",
      "/dev/stdout": "",
      "/dev/stderr": "",
    };
    for (const key of Object.keys(fs)) {
      jsonFs[key] = fs[key].content;
    }
    wasmfs.fromJSON(jsonFs);

    return await headlessRunCommand(command, wasmfs, stdin);
  }
}
