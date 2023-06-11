import { EditorElement } from "./editor";
import { TerminalElement } from "./terminal";
import {
  RunResult,
  WASIFS,
  Runtime,
  Syntax,
  RuntimeMethods,
} from "@runno/host";
import { ControlsElement } from "./controls";
import { commandsForRuntime, getBinaryPathFromCommand } from "./commands";
import { headlessPrepareFS, headlessRunCode, headlessRunFS } from "./headless";
import { fetchWASIFS } from "./helpers";

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
    return this.interactiveRunFS(runtime, "/program", {
      "/program": {
        path: "/program",
        content: code,
        mode: "string",
        timestamps: {
          access: new Date(),
          modification: new Date(),
          change: new Date(),
        },
      },
    });
  }

  async interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: WASIFS
  ): Promise<RunResult> {
    this.terminal.terminal.clear();
    this.terminal.terminal.write("Preparing environment...");

    const commands = commandsForRuntime(runtime, entryPath);

    try {
      const prepare = await headlessPrepareFS(commands.prepare ?? [], fs);
      fs = prepare.fs;
    } catch (e) {
      console.error(e);
      this.terminal.terminal.write(`\nRunno crashed: ${e}`);
      return {
        resultType: "crash",
        error: e,
      };
    }

    const { run } = commands;
    const binaryPath = getBinaryPathFromCommand(run, fs);

    this.terminal.terminal.clear();

    if (run.baseFSURL) {
      const baseFS = await fetchWASIFS(run.baseFSURL);
      fs = { ...fs, ...baseFS };
    }

    return this.terminal.run(
      binaryPath,
      run.binaryName,
      fs,
      run.args ?? [],
      run.env ?? {}
    );
  }

  interactiveStop(): void {
    return this.terminal.stop();
  }

  headlessRunCode(
    runtime: Runtime,
    code: string,
    stdin?: string
  ): Promise<RunResult> {
    return headlessRunCode(runtime, code, stdin);
  }

  async headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: WASIFS,
    stdin?: string
  ): Promise<RunResult> {
    return headlessRunFS(runtime, entryPath, fs, stdin);
  }
}
