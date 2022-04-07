import { EditorElement } from "./editor";
import { TerminalElement } from "./terminal";
import {
  RunResult,
  CommandResult,
  FS,
  Runtime,
  Syntax,
  RuntimeMethods,
} from "@runno/host";
import { WasmFs } from "./wasmfs";
import { headlessRunCommand } from "./headless";
import { ControlsElement } from "./controls";

type RuntimeCommands = {
  prepare?: Array<string>;
  run: string;
};

function commandsForRuntime(name: string, entryPath: string): RuntimeCommands {
  if (name === "python") {
    return { run: `python ${entryPath}` };
  }

  if (name === "ruby") {
    return { run: `cat ${entryPath} | ruby --disable=gems` };
  }

  if (name === "quickjs") {
    return { run: `quickjs --std ${entryPath}` };
  }

  if (name === "sqlite") {
    return { run: `cat ${entryPath} | sqlite` };
  }

  if (name === "clang" || name === "clangpp") {
    return {
      prepare: [
        `runno-clang -cc1 -Werror -emit-obj -disable-free -isysroot /sys -internal-isystem /sys/include/c++/v1 -internal-isystem /sys/include -internal-isystem /sys/lib/clang/8.0.1/include -ferror-limit 4 -fmessage-length 80 -fcolor-diagnostics -O2 -o program.o -x c++  ${entryPath}`,
        `runno-wasm-ld --no-threads --export-dynamic -z stack-size=1048576 -L/sys/lib/wasm32-wasi /sys/lib/wasm32-wasi/crt1.o program.o -lc -lc++ -lc++abi -o ./program.wasm`,
      ],
      run: `wasmer run ./program.wasm`,
    };
  }

  throw new Error(`Unknown runtime ${name}`);
}

export class RunnoProvider implements RuntimeMethods {
  terminal: TerminalElement;
  editor: EditorElement;
  controls?: ControlsElement;

  constructor(
    terminal: TerminalElement,
    editor: EditorElement,
    controls?: ControlsElement
  ) {
    this.terminal = terminal;
    this.editor = editor;
    this.controls = controls;
  }

  //
  // Private Helpers
  //

  writeFS(fs: FS) {
    for (const [name, file] of Object.entries(fs)) {
      this.terminal.writeFile(name, file.content);
    }
  }

  //
  // Public Interface
  //

  showControls() {
    this.controls?.show();
  }

  hideControls() {
    this.controls?.hide();
  }

  showEditor() {
    this.editor.show();
  }

  hideEditor() {
    this.editor.hide();
  }

  setEditorProgram(syntax: Syntax, runtime: Runtime, code: string) {
    this.editor.setProgram(syntax, runtime, code);
  }

  getEditorProgram() {
    return Promise.resolve(this.editor.program);
  }

  interactiveRunCode(runtime: Runtime, code: string): Promise<RunResult> {
    return this.interactiveRunFS(runtime, "program", {
      program: { name: "program", content: code },
    });
  }

  async interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<RunResult> {
    const commands = commandsForRuntime(runtime, entryPath);

    this.writeFS(fs);

    let prepare: CommandResult | undefined = undefined;
    if (commands.prepare) {
      prepare = {
        stdin: "",
        stdout: "",
        stderr: "",
        tty: "",
        fs: {},
        exit: 0,
      };
      for (const command of commands.prepare || []) {
        const { result } = await this.interactiveUnsafeCommand(command, {});
        if (!result) {
          throw new Error("Unexpected missing result");
        }
        prepare.stdin += result.stdin;
        prepare.stdout += result.stdout;
        prepare.stderr += result.stderr;
        prepare.tty += result.tty;

        // It's okay not to merge here since the FS is cumulative
        // over each run.
        prepare.fs = result.fs;
        prepare.exit = result.exit;

        if (result.exit !== 0) {
          // If a prepare step fails then we stop.
          return {
            prepare,
          };
        }
      }
    }

    const { result } = await this.interactiveUnsafeCommand(commands.run, {});
    return { result, prepare };
  }

  async interactiveUnsafeCommand(command: string, fs: FS): Promise<RunResult> {
    this.writeFS(fs);
    this.terminal.clear();
    let result = await this.terminal.runCommand(command);
    if (result.exit === 1) {
      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent
      );
      if (isSafari) {
        // Safari seems to hit its call stack maximum probably due to the super
        // large number of promises used, followed by calling WebAssembly etc.
        // A neat solution is to just run the whole thing again since the second
        // time it uses less promises because the binary is already downloaded.
        // TODO: Fix this a different way see:
        // https://github.com/taybenlor/runno/issues/152
        this.writeFS(fs);
        this.terminal.clear();
        this.terminal.wasmTerminal.wasmTty.clearTty();
        result = await this.terminal.runCommand(command);
      }
    }
    return {
      result,
    };
  }

  interactiveStop(): void {
    return this.terminal.stop();
  }

  headlessRunCode(
    runtime: Runtime,
    code: string,
    stdin?: string
  ): Promise<RunResult> {
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
  ): Promise<RunResult> {
    const commands = commandsForRuntime(runtime, entryPath);

    let prepare: CommandResult | undefined = undefined;
    if (commands.prepare) {
      prepare = {
        stdin: "",
        stdout: "",
        stderr: "",
        tty: "",
        fs: {},
        exit: 0,
      };
      for (const command of commands.prepare || []) {
        const { result } = await this.interactiveUnsafeCommand(command, {});
        if (!result) {
          throw new Error("Unexpected missing result");
        }
        prepare.stdin += result.stdin;
        prepare.stdout += result.stdout;
        prepare.stderr += result.stderr;
        prepare.tty += result.tty;

        // It's okay not to merge here since the FS is cumulative
        // over each run.
        prepare.fs = result.fs;
        prepare.exit = result.exit;

        if (result.exit !== 0) {
          // If a prepare step fails then we stop.
          return {
            prepare,
          };
        }
      }
    }

    const { result } = await this.headlessUnsafeCommand(
      commands.run,
      fs,
      stdin
    );
    return {
      result,
      prepare,
    };
  }

  async headlessUnsafeCommand(
    command: string,
    fs: FS,
    stdin?: string
  ): Promise<RunResult> {
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

    const result = await headlessRunCommand(command, wasmfs, stdin);
    return {
      result,
    };
  }
}
