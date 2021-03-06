import { WasmFs } from "@wasmer/wasmfs";
import CommandOptions from "./command-options";

export default class Command {
  options: CommandOptions;

  constructor(options: CommandOptions) {
    this.options = options;
  }
  // @ts-ignore - wasmFs is needed by subclasses
  async run(wasmFs: WasmFs) {
    throw new Error("run not implemented by the Command subclass");
  }
}
