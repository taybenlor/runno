import { html, css, LitElement } from "lit";
import { property, state } from "lit/decorators.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";

import { Runtime, RuntimeMethods, Syntax, CommandResult } from "@runno/host";
import { EditorElement } from "./editor";
import { ControlsElement } from "./controls";
import { TerminalElement } from "./terminal";
import { RunnoProvider } from "./provider";

export class RuntimeElement extends LitElement {
  static styles = css`
    runno-editor {
      background: white;
    }
  `;

  @property({ type: Boolean }) editor: boolean = false;
  @property({ type: Boolean }) controls: boolean = false;

  public provider!: RuntimeMethods;

  editorRef: Ref<EditorElement> = createRef();
  controlsRef: Ref<ControlsElement> = createRef();
  terminalRef: Ref<TerminalElement> = createRef();

  @state() private _running: Boolean = false;

  public get running() {
    return this._running;
  }

  public async run(): Promise<CommandResult> {
    const editor = this.editorRef.value!;
    if (!editor.runtime) {
      throw new Error("The editor has no runtime");
    }
    this._running = true;
    const result = await this.provider.interactiveRunCode(
      editor.runtime,
      editor.program
    );
    this._running = false;
    return result;
  }

  public stop() {
    return this.provider.interactiveStop();
  }

  public setProgram(syntax: Syntax, runtime: Runtime, code: string) {
    this.editorRef.value!.setProgram(syntax, runtime, code);
  }

  //
  // Lifecycle
  //

  firstUpdated() {
    this.provider = new RunnoProvider(
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
