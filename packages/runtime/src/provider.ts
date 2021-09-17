import { Editor } from "./editor";
import { Terminal } from "./terminal";
import { CommandResult, FS, Runtime, Syntax } from "./types";
import { WasmFs } from "./wasmfs";
import { headlessRunCommand } from "./headless";

function commandForRuntime(name: string, entryPath: string) {
  if (name === "python") {
    return `python ${entryPath}`;
  }

  if (name === "quickjs") {
    return `quickjs --std ${entryPath}`;
  }

  if (name === "sqlite") {
    return `cat ${entryPath} | sqlite`;
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

  interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<CommandResult> {
    const command = commandForRuntime(runtime, entryPath);
    return this.interactiveUnsafeCommand(command, fs);
  }

  interactiveUnsafeCommand(command: string, fs: FS): Promise<CommandResult> {
    for (const key of Object.keys(fs)) {
      this.terminal.writeFile(key, fs[key].content);
    }

    return this.terminal.runCommand(command);
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

  headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS,
    stdin?: string
  ): Promise<CommandResult> {
    const command = commandForRuntime(runtime, entryPath);
    return this.headlessUnsafeCommand(command, fs, stdin);
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
