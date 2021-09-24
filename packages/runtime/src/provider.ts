import { Editor } from "./editor";
import { Terminal } from "./terminal";
import { CommandResult, FS, Runtime, Syntax } from "./types";
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

export class RunnoProvider {
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
    let stdin = "";
    let stdout = "";
    let stderr = "";
    let tty = "";
    for (const command of commands.prepare || []) {
      const result = await this.interactiveUnsafeCommand(command, {});
      stdin += result.stdin;
      stdout += result.stdout;
      stderr += result.stderr;
      tty += result.tty;
    }
    const result = await this.interactiveUnsafeCommand(commands.run, {});

    return {
      stdin: stdin + result.stdin,
      stdout: stdout + result.stdout,
      stderr: stderr + result.stderr,
      tty: tty + result.tty,
      fs: result.fs,
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
    for (const command of commands.prepare || []) {
      // TODO: Do a better job of dealing with intermediate state
      const result = await this.headlessUnsafeCommand(command, fs, stdin);
      fs = result.fs;
    }
    return this.headlessUnsafeCommand(commands.run, fs, stdin);
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

  //
  // Private Helpers
  //
}
