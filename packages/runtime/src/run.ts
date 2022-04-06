import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";

import { Runtime, RuntimeMethods, Syntax, RunResult, FS } from "@runno/host";
import { EditorElement } from "./editor";
import { ControlsElement } from "./controls";
import { TerminalElement } from "./terminal";
import { RunnoProvider } from "./provider";
import { elementCodeContent } from "./helpers";

export class RunElement extends LitElement implements RuntimeMethods {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 140px;
    }

    runno-editor {
      background: white;
      color: black;
      max-height: 70vh;
      overflow: auto;
    }

    runno-controls {
      flex-shrink: 0;
    }

    runno-terminal {
      flex-grow: 1;
      height: 150px;
    }
  `;

  @property({ type: String }) runtime: string = "python";
  @property({ type: String }) syntax?: string;
  @property({ type: String }) code?: string;
  @property({ type: Boolean, reflect: true }) editor: boolean = false;
  @property({ type: Boolean, reflect: true }) controls: boolean = false;

  editorRef: Ref<EditorElement> = createRef();
  controlsRef: Ref<ControlsElement> = createRef();
  terminalRef: Ref<TerminalElement> = createRef();

  @state() private _running: Boolean = false;

  private _provider!: RuntimeMethods;

  public get running() {
    return this._running;
  }

  public async run(): Promise<RunResult> {
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

  showControls() {
    this.controls = true;
  }

  hideControls() {
    this.controls = false;
  }

  showEditor() {
    this.editor = true;
  }

  hideEditor() {
    this.editor = false;
  }

  setEditorProgram(syntax: Syntax, runtime: Runtime, code: string) {
    return this._provider.setEditorProgram(syntax, runtime, code);
  }

  getEditorProgram() {
    return this._provider.getEditorProgram();
  }

  async interactiveRunCode(runtime: Runtime, code: string): Promise<RunResult> {
    this._running = true;
    const result = await this._provider.interactiveRunCode(runtime, code);
    this._running = false;
    return result;
  }

  async interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<RunResult> {
    this._running = true;
    const result = await this._provider.interactiveRunFS(
      runtime,
      entryPath,
      fs
    );
    this._running = false;
    return result;
  }

  async interactiveUnsafeCommand(command: string, fs: FS): Promise<RunResult> {
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
  ): Promise<RunResult> {
    return this._provider.headlessRunCode(runtime, code, stdin);
  }

  headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS,
    stdin?: string
  ): Promise<RunResult> {
    return this._provider.headlessRunFS(runtime, entryPath, fs, stdin);
  }

  headlessUnsafeCommand(
    command: string,
    fs: FS,
    stdin?: string
  ): Promise<RunResult> {
    return this._provider.headlessUnsafeCommand(command, fs, stdin);
  }

  //
  // Lifecycle
  //

  connectedCallback() {
    super.connectedCallback();

    setTimeout(() => {
      if (!this.code) {
        const code = elementCodeContent(this);
        if (code.trim() != "") {
          this.code = code;
        }
      }
    }, 0);
  }

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
      <runno-editor
        runtime=${this.runtime}
        syntax=${this.syntax}
        code=${this.code}
        ${ref(this.editorRef)}
        ?hidden=${!this.editor}
      ></runno-editor>
      <runno-controls
        ${ref(this.controlsRef)}
        ?hidden=${!this.controls}
        ?running=${this._running}
        @runno-run=${this.run}
        @runno-stop=${this.stop}
      ></runno-controls>
      <runno-terminal ${ref(this.terminalRef)}></runno-terminal>
      <pre hidden><slot></slot></pre>
    `;
  }
}
