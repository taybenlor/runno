// TODO: Use this version when deploying?
import WasmTerminal from "@wasmer/wasm-terminal/lib/optimized/wasm-terminal.esm";
//import WasmTerminal from "@wasmer/wasm-terminal";
import processWorkerURL from "@wasmer/wasm-terminal/lib/workers/process.worker.js?url";
import { WasmFs } from "./wasmfs";

import WAPM from "./wapm/wapm";

// Setup for wasmer interactions
const wasmFs = new WasmFs();
const wasmTerminal = new WasmTerminal({
  processWorkerUrl: processWorkerURL,
  fetchCommand: fetchCommand,
  wasmFs: wasmFs,
});
const wapm = new WAPM(wasmTerminal, wasmFs);

// Show terminal in DOM
const terminalEl = document.querySelector<HTMLElement>("#wasm-terminal")!;
wasmTerminal.open(terminalEl);
window.addEventListener("resize", function () {
  wasmTerminal.fit();
});

// Handle params (if there are any)
startCommandFromParams();

//
// Helpers
//

async function fetchCommand(options: any) {
  return await wapm.runCommand(options);
}

function startCommandFromParams() {
  let command = "echo unsupported command specified";

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.replace("#", "?")
  );
  let code = hashParams.get("code") || searchParams.get("code") || undefined;
  const wapmCommand = hashParams.get("wapm") || searchParams.get("wapm");
  const runtimeCommand =
    hashParams.get("runtime") || searchParams.get("runtime");
  if (wapmCommand) {
    command = wapmCommand;
  } else if (runtimeCommand) {
    const runtime = runtimeCommand;
    if (runtime === "python") {
      command = "python";
    }
  } else {
    // No command was specified
    return;
  }
  console.log("doing command", command, code);
  startCommand(command, code);
}

function startCommand(command: string, code: string | undefined) {
  // Wait for the terminal to open and start prompting
  if (!wasmTerminal.isOpen || !wasmTerminal.wasmShell.isPrompting()) {
    setTimeout(() => startCommand(command, code), 50);
  }

  if (code) {
    wasmFs.volume.writeFileSync("/program", code);
    wasmTerminal.runCommand(`${command} program`);
  } else {
    wasmTerminal.runCommand(`${command}`);
  }
  wasmTerminal.focus();
}
