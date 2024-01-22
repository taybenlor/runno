import { EditorElement } from "./elements/editor";
import { TerminalElement } from "./elements/terminal";
import { RunResult, Runtime, Syntax, RuntimeMethods } from "./types";
import { ControlsElement } from "./elements/controls";
import { commandsForRuntime, getBinaryPathFromCommand } from "./commands";
import { headlessPrepareFS, headlessRunCode, headlessRunFS } from "./headless";
import { fetchWASIFS, makeRunnoError } from "./helpers";
import { WASIFS } from "@runno/wasi";

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
    const entryPath = "/program";
    return this.interactiveRunFS(runtime, entryPath, {
      [entryPath]: {
        path: entryPath,
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
    this.terminal.terminal.write("Preparing environment...\n");

    const commands = commandsForRuntime(runtime, entryPath);

    try {
      const prepare = await headlessPrepareFS(commands.prepare ?? [], fs);
      fs = prepare.fs;
    } catch (e) {
      console.error(e);
      if (
        e != null &&
        (e instanceof Error || (typeof e === "object" && "message" in e))
      ) {
        this.terminal.terminal.write(
          `\n[Crashed] ${(e as any).type ?? "Error"}: ${e.message}\n`
        );
      }

      return {
        resultType: "crash",
        error: makeRunnoError(e),
      };
    }

    const { run } = commands;
    const binaryPath = getBinaryPathFromCommand(run, fs);

    // wait for terminal to write before we clear it
    await new Promise((r) => setTimeout(r));
    this.terminal.terminal.clear();

    if (run.baseFSURL) {
      try {
        const baseFS = await fetchWASIFS(run.baseFSURL);
        fs = { ...fs, ...baseFS };
      } catch (e) {
        console.error(e);
        if (
          e != null &&
          (e instanceof Error || (typeof e === "object" && "message" in e))
        ) {
          this.terminal.terminal.write(
            `\n[Crashed] ${(e as any).type ?? "Error"}: ${e.message}\n`
          );
        }

        return {
          resultType: "crash",
          error: makeRunnoError(e),
        };
      }
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
