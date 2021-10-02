import { createConnection } from "./messaging";
import { TerminalElement } from "./terminal";
import { handleParams } from "./params";
import { EditorElement } from "./editor";
import { RunnoProvider } from "./provider";
import { ControlsElement } from "./controls";

customElements.define("runno-terminal", TerminalElement);
customElements.define("runno-editor", EditorElement);
customElements.define("runno-controls", ControlsElement);

// Show terminal in DOM
const terminal = document.querySelector<TerminalElement>("runno-terminal")!;
const editor = document.querySelector<EditorElement>("runno-editor")!;
const controls = document.querySelector<ControlsElement>("runno-controls")!;

// TODO: The provider should be re-written as a web component
//       then I can use it to coordinate the state of the controls.
//       Right now there's nothing that can set "running" on the
//       controls.
//
//       The <runno-provider> can also be the main library export for this
//       and the website can be moved to "client" or something like that
//       then there'll be a web component you can use with this package!
const provider = new RunnoProvider(terminal, editor);

controls.addEventListener("runno-run", () => {
  if (!editor.runtime) {
    // The editor doesn't have a runtime to run with
    return;
  }

  provider.interactiveRunCode(editor.runtime, editor.program);
});

// Set up iframe messaging connections
createConnection(provider).then(() => {});

// Handle params (if there are any)
handleParams(provider);
