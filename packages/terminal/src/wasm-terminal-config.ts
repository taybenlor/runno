// The configuration options passed when creating the Wasm terminal

import { WasmFs } from "@wasmer/wasmfs";
import CommandOptions from "./command/command-options";

// A Custom command is a function that takes in a stdin string, and an array of argument strings,
// And returns an stdout string, or undefined.
export type CallbackCommand = (
  args: string[],
  stdin: string
) => Promise<string>;

type FetchCommandFunction = (options: {
  args: Array<string>;
  env: { [key: string]: string };
}) => Promise<Uint8Array | CallbackCommand | CommandOptions>;

export default class WasmTerminalConfig {
  fetchCommand: FetchCommandFunction;
  processWorkerUrl: string;
  wasmFs: WasmFs;

  constructor({
    fetchCommand,
    processWorkerUrl,
    wasmFs = new WasmFs(),
  }: {
    fetchCommand: FetchCommandFunction;
    processWorkerUrl: string;
    wasmFs: WasmFs;
  }) {
    this.fetchCommand = fetchCommand;
    this.processWorkerUrl = processWorkerUrl;
    this.wasmFs = wasmFs;
  }
}
