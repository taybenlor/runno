import { createConnection } from "./messaging";
import { Terminal } from "./terminal";

// Show terminal in DOM
const terminalEl = document.querySelector<HTMLElement>("#wasm-terminal")!;
const terminal = new Terminal(terminalEl);

// Set up iframe messaging connections
createConnection(terminal).then((connection) => {});

// Handle params (if there are any)
handleParams();

function handleParams() {
  const hash = window.location.hash.slice(1);
  const search = window.location.search.slice(1);
  const urlParams = `${hash}&${search}`;
  const params = new URLSearchParams(urlParams);

  const code = params.get("code") || undefined;
  if (code) {
    terminal.writeFile("/code", code);
  }

  const command = params.get("command");
  const runtimeName = params.get("runtime");
  if (command) {
    terminal.runCommand(command);
  } else if (runtimeName) {
    const args = code ? " code" : "";
    if (runtimeName === "python") {
      terminal.runCommand(`python${args}`);
    }
  } else {
    // No command was specified
    return;
  }

  terminal.focus();
}
