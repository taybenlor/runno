import { createConnection } from "./messaging";
import { Terminal } from "./terminal";
import { handleParams } from "./params";
import { Editor } from "./editor";
import { RunnoProvider } from "./provider";

// Show terminal in DOM
const terminalEl = document.querySelector<HTMLElement>("#wasm-terminal")!;
const terminal = new Terminal(terminalEl);

// Show code editor in DOM
const containerEl = document.querySelector<HTMLElement>("#editor-container")!;
const editor = new Editor(containerEl);

const provider = new RunnoProvider(terminal, editor);

// Set up iframe messaging connections
createConnection(provider).then(() => {});

// Handle params (if there are any)
handleParams(provider);
