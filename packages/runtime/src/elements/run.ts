import { html, css, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";

import {
  Runtime,
  RuntimeMethods,
  Syntax,
  RunResult,
  WASIFS,
} from "@runno/host";
import { EditorElement } from "./editor";
import { ControlsElement } from "./controls";
import { TerminalElement } from "./terminal";
import { RunnoProvider } from "../provider";
import { elementCodeContent, fetchWASIFS } from "../helpers";
import { FileElement } from "./file";

@customElement("runno-run")
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
      height: var(--runno-editor-height, auto);
      max-height: var(--runno-editor-max-height, 60%);
    }

    runno-controls {
      flex-shrink: 0;
    }

    runno-terminal {
      background: black;
      flex-grow: 1;
      height: var(--runno-terminal-height, auto);
      min-height: var(--runno-terminal-min-height, 4rem);
    }
  `;

  @property({ type: String }) runtime: string = "python";
  @property({ type: String }) syntax?: string;
  @property({ type: String }) code?: string;
  @property({ type: String, attribute: "fs-url" }) fsURL?: string;
  @property({ type: Boolean, reflect: true }) editor: boolean = false;
  @property({ type: Boolean, reflect: true }) controls: boolean = false;
  @property({ type: Boolean, reflect: true }) autorun: boolean = false;

  fs: WASIFS = {};

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

    this._running = true;

    let fs: WASIFS = this.fs;

    if (this.fsURL) {
      const baseFS = await fetchWASIFS(this.fsURL);
      fs = { ...baseFS, ...fs };
    }

    const fileElements = Array.from(
      this.querySelectorAll<FileElement>("runno-file")
    );
    const files = await Promise.all(fileElements.map((f) => f.getFile()));
    for (const file of files) {
      fs[file.path] = file;
    }

    fs = {
      ...fs,
      "/program": {
        path: "program",
        content: editor.program,
        mode: "string",
        timestamps: {
          access: new Date(),
          modification: new Date(),
          change: new Date(),
        },
      },
    };

    return this.interactiveRunFS(editor.runtime, "/program", fs);
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
    fs: WASIFS
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
    fs: WASIFS,
    stdin?: string
  ): Promise<RunResult> {
    return this._provider.headlessRunFS(runtime, entryPath, fs, stdin);
  }

  //
  // Lifecycle
  //

  connectedCallback() {
    super.connectedCallback();

    setTimeout(() => {
      if (!this.code) {
        // Prevent file elements from impacting extracting code content
        const fileElements = Array.from(this.querySelectorAll("runno-file"));
        fileElements.forEach((el) => el.remove());

        const code = elementCodeContent(this);
        if (code.trim() != "") {
          this.code = code;
        }

        this.append(...fileElements);
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

  // attributeChangedCallback(
  //   name: string,
  //   _old: string | null,
  //   value: string | null
  // ): void {
  //   super.attributeChangedCallback(name, _old, value);

  //   if (name === "autorun" && value !== null) {
  //     setTimeout(this.run);
  //   }
  // }

  render() {
    return html`
      <runno-editor
        ${ref(this.editorRef)}
        runtime=${this.runtime}
        syntax=${this.syntax}
        code=${this.code}
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
