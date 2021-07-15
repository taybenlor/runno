import { createConnection } from "./messaging";
import { Terminal } from "./terminal";
import { handleParams } from "./params";

// Show terminal in DOM
const terminalEl = document.querySelector<HTMLElement>("#wasm-terminal")!;
const terminal = new Terminal(terminalEl);

// Set up iframe messaging connections
createConnection(terminal).then(() => {});

// Handle params (if there are any)
handleParams(terminal);
