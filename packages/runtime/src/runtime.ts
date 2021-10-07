import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";

import {
  Runtime,
  RuntimeMethods,
  Syntax,
  CommandResult,
  FS,
} from "@runno/host";
import { EditorElement } from "./editor";
import { ControlsElement } from "./controls";
import { TerminalElement } from "./terminal";
import { RunnoProvider } from "./provider";

export class RuntimeElement extends LitElement implements RuntimeMethods {
  static styles = css`
    runno-editor {
      background: white;
    }
  `;

  @property({ type: Boolean }) editor: boolean = false;
  @property({ type: Boolean }) controls: boolean = false;

  editorRef: Ref<EditorElement> = createRef();
  controlsRef: Ref<ControlsElement> = createRef();
  terminalRef: Ref<TerminalElement> = createRef();

  @state() private _running: Boolean = false;

  private _provider!: RuntimeMethods;

  public get running() {
    return this._running;
  }

  public async run(): Promise<CommandResult> {
    const editor = this.editorRef.value!;
    if (!editor.runtime) {
      throw new Error("The editor has no runtime");
    }

    return this.interactiveRunCode(editor.runtime, editor.program);
  }

  public stop() {
    return this.interactiveStop();
  }

  public setProgram(syntax: Syntax, runtime: Runtime, code: string) {
    this.editorRef.value!.setProgram(syntax, runtime, code);
  }

  //
  // Runtime Methods
  //

  showEditor() {
    return this._provider.showEditor();
  }

  hideEditor() {
    return this._provider.hideEditor();
  }

  setEditorProgram(syntax: Syntax, runtime: Runtime, code: string) {
    return this._provider.setEditorProgram(syntax, runtime, code);
  }

  async interactiveRunCode(
    runtime: Runtime,
    code: string
  ): Promise<CommandResult> {
    this._running = true;
    const result = await this._provider.interactiveRunCode(runtime, code);
    this._running = false;
    return result;
  }

  async interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<CommandResult> {
    this._running = true;
    const result = await this._provider.interactiveRunFS(
      runtime,
      entryPath,
      fs
    );
    this._running = false;
    return result;
  }

  async interactiveUnsafeCommand(
    command: string,
    fs: FS
  ): Promise<CommandResult> {
    this._running = true;
    const result = await this._provider.interactiveUnsafeCommand(command, fs);
    this._running = false;
    return result;
  }

  interactiveStop() {
    return this._provider.interactiveStop();
  }

  headlessRunCode(
    runtime: Runtime,
    code: string,
    stdin?: string
  ): Promise<CommandResult> {
    return this._provider.headlessRunCode(runtime, code, stdin);
  }

  headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS,
    stdin?: string
  ): Promise<CommandResult> {
    return this._provider.headlessRunFS(runtime, entryPath, fs, stdin);
  }

  headlessUnsafeCommand(
    command: string,
    fs: FS,
    stdin?: string
  ): Promise<CommandResult> {
    return this._provider.headlessUnsafeCommand(command, fs, stdin);
  }

  //
  // Lifecycle
  //

  firstUpdated() {
    this._provider = new RunnoProvider(
      this.terminalRef.value!,
      this.editorRef.value!
    );

    const event = new Event("runno-ready", {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <runno-editor ${ref(this.editorRef)}></runno-editor>
      <runno-controls
        ${ref(this.controlsRef)}
        ?hidden=${!this.controls}
        ?running=${this._running}
        @runno-run=${this.run}
        @runno-stop=${this.stop}
      ></runno-controls>
      <runno-terminal ${ref(this.terminalRef)}></runno-terminal>
    `;
  }
}
