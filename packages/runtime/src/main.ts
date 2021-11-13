import { TerminalElement } from "./elements/terminal";
import { EditorElement } from "./elements/editor";
import { ControlsElement } from "./elements/controls";
import { RunElement } from "./elements/run";
import { CodeElement } from "./elements/code";
import { headlessRunCommand } from "./headless";
import { RunnoProvider } from "./provider";

function defineElements() {
  customElements.define("runno-terminal", TerminalElement);
  customElements.define("runno-editor", EditorElement);
  customElements.define("runno-controls", ControlsElement);
  customElements.define("runno-run", RunElement);
  customElements.define("runno-code", CodeElement);
}

export {
  TerminalElement,
  EditorElement,
  ControlsElement,
  RunElement,
  CodeElement,
  RunnoProvider,
  headlessRunCommand,
  defineElements,
};
