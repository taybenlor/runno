import { html, css, LitElement } from "lit";
import { property } from "lit/decorators";
import { createRef, Ref, ref } from "lit/directives/ref";

import { RuntimeMethods } from "@runno/host";
import { EditorElement } from "./editor";
import { ControlsElement } from "./controls";
import { TerminalElement } from "./terminal";
import { RunnoProvider } from "./provider";

export class RuntimeElement extends LitElement {
  provider!: RuntimeMethods;

  editorRef: Ref<EditorElement> = createRef();
  controlsRef: Ref<ControlsElement> = createRef();
  terminalRef: Ref<TerminalElement> = createRef();

  firstUpdated() {
    this.provider = new RunnoProvider(
      this.terminalRef.value!,
      this.editorRef.value!
    );
  }

  render() {
    return html`
      <runno-editor ${ref(this.editorRef)}></runno-editor>

      <!-- TODO: Listen to events on the runno-controls element -->
      <!-- TODO: Set the running property on the controls when it is running -->
      <runno-controls ${ref(this.controlsRef)}></runno-controls>
      <runno-terminal ${ref(this.terminalRef)}></runno-terminal>
    `;
  }
}
