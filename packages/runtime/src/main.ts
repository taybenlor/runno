import { TerminalElement } from "./terminal";
import { EditorElement } from "./editor";
import { ControlsElement } from "./controls";
import { RunElement } from "./run";
import { headlessRunCommand } from "./headless";
import { RunnoProvider } from "./provider";

function defineElements() {
  customElements.define("runno-terminal", TerminalElement);
  customElements.define("runno-editor", EditorElement);
  customElements.define("runno-controls", ControlsElement);
  customElements.define("runno-run", RunElement);
}

export {
  TerminalElement,
  EditorElement,
  ControlsElement,
  RunElement,
  RunnoProvider,
  headlessRunCommand,
  defineElements,
};
