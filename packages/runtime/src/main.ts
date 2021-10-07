import { createConnection } from "./messaging";
import { TerminalElement } from "./terminal";
import { handleParams } from "./params";
import { EditorElement } from "./editor";
import { ControlsElement } from "./controls";
import { RunElement } from "./run";

customElements.define("runno-terminal", TerminalElement);
customElements.define("runno-editor", EditorElement);
customElements.define("runno-controls", ControlsElement);
customElements.define("runno-run", RunElement);

// Show terminal in DOM
const runtime = document.querySelector<RunElement>("runno-runtime")!;

runtime.addEventListener("runno-ready", () => {
  // Set up iframe messaging connections
  createConnection(runtime).then(() => {});

  // Handle params (if there are any)
  handleParams(runtime);
});
