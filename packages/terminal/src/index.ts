import WasmTerminal from "./wasm-terminal";
import { fetchCommandFromWAPM as fetchCommandFromWAPMImport } from "./functions/fetch-command-wapm";

export default WasmTerminal;
export const fetchCommandFromWAPM = fetchCommandFromWAPMImport;
export { default as CommandRunner } from "./command-runner/command-runner";
export { default as WasmTerminalConfig } from "./wasm-terminal-config";
