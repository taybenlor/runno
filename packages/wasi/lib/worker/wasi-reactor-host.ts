import { WASIContextOptions } from "../wasi/wasi-context";
import {
  WASMArgMessage,
  HostMessage,
  WorkerMessage,
} from "./wasi-reactor-worker";
import { WASMArg, Int32, Uint32 } from "../types";
import WASIReactorWorker from "./wasi-reactor-worker?worker&inline";

function sendMessage(worker: Worker, message: WorkerMessage) {
  worker.postMessage(message);
}

// (export function names) => (worker promises)
type Exports = Record<string, Function>;
type Callbacks = Record<number, { resolve: Function; reject: Function }>;
type WASIWorkerHostContext = Partial<Omit<WASIContextOptions, "stdin">>;

export class WASIReactorWorkerHost {
  binaryURL: string;
  context: WASIWorkerHostContext;

  worker!: Worker;
  exports: Exports = {};
  memory_start_index: number;

  callbacks: Callbacks = {};

  constructor(
    binaryURL: string,
    memory_start_index: number = 0,
    context: WASIWorkerHostContext,
    errorHandler: (err: any) => void
  ) {
    this.binaryURL = binaryURL;
    this.memory_start_index = memory_start_index;
    this.context = context;
    window.addEventListener("unhandledrejection", (event) =>
      errorHandler(event.reason)
    );
  }

  initialize() {
    return new Promise<void>((resolve, _) => {
      this.worker = new WASIReactorWorker();
      this.worker.addEventListener("message", (messageEvent) => {
        const message: HostMessage = messageEvent.data;
        switch (message.type) {
          case "stdout":
            this.context.stdout?.(message.text);
            break;
          case "stderr":
            this.context.stderr?.(message.text);
            break;
          case "debug":
            this.context.debug?.(
              message.name,
              message.args,
              message.ret,
              message.data
            );
            break;
          case "initialized":
            message.exports.forEach((func_name: any, id: number) => {
              if (func_name === "memory") {
                return;
              }
              this.exports[func_name] = (...args: WASMArg[]) => {
                let typed_args: WASMArgMessage[] = [];
                args.forEach((arg: WASMArg) => {
                  let arg_type: any;
                  switch (true) {
                    case arg instanceof Int32:
                      arg_type = "Int32";
                      break;
                    case arg instanceof Uint32:
                      arg_type = "Uint32";
                      break;
                    case typeof arg === "string":
                      arg_type = "string";
                      break;
                    case arg instanceof Int32Array:
                      arg_type = "Int32Array";
                      break;
                    case arg instanceof Uint32Array:
                      arg_type = "Uint32Array";
                      break;
                  }
                  typed_args.push({ type: arg_type, data: arg });
                });
                return new Promise((resolve, reject) => {
                  sendMessage(this.worker, {
                    target: "client",
                    type: "call",
                    call_id: id,
                    method: func_name,
                    args: typed_args,
                  });
                  this.callbacks[id] = {
                    resolve: resolve,
                    reject: reject,
                  };
                });
              };
            });
            resolve();
            break;
          case "result":
            if (message.err_code === 0) {
              let ret_vals: any[] = [];
              let offset: number = this.memory_start_index;
              while (true) {
                // arg_length includes any bits used for tagging and length storing
                const [arg, new_offset] = this.parseArg(offset, message.memory);
                if (arg === null) {
                  break;
                }
                ret_vals.push(arg);
                offset = new_offset;
              }

              this.callbacks[message.call_id].resolve(ret_vals);
            } else {
              this.callbacks[message.call_id].reject(message.err_code);
            }

            // Wipe memory buffer for next export call
            const buffer = new Uint8Array(
              message.memory,
              this.memory_start_index,
              length
            );
            buffer.fill(0);
            break;
        }
      });

      sendMessage(this.worker, {
        target: "client",
        type: "initialize",
        binaryURL: this.binaryURL,
        memory_start_index: this.memory_start_index,
        args: this.context.args,
        env: this.context.env,
        fs: this.context.fs,
        isTTY: this.context.isTTY,
      });
    });
  }

  parseArg(start_index: number, memory: SharedArrayBuffer): [any, number] {
    const view = new DataView(memory);
    const little_endian = true;

    const tag = view.getInt8(start_index);
    start_index += 1;

    let arg;
    switch (tag) {
      case -1:
        arg = null;
        break;
      case 1:
        arg = view.getInt32(start_index, little_endian);
        start_index += 4;
        break;
      case 2:
        arg = view.getUint32(start_index, little_endian);
        start_index += 4;
        break;
      case 3:
        const str_length = view.getUint32(start_index, little_endian);
        start_index += 4;

        const str_buffer = new Uint8Array(memory, start_index, str_length);
        start_index += str_length;

        arg = new TextDecoder().decode(str_buffer);
        break;
      case 4:
        const i32_length = view.getUint32(start_index, little_endian);
        start_index += 4;

        let i32_buffer = [];
        let i32_i = 0;
        while (i32_i < i32_length) {
          i32_buffer.push(view.getInt32(start_index, little_endian));
          i32_i += 1;
          start_index += 4;
        }

        arg = new Int32Array(i32_buffer);
        break;
      case 5:
        const u32_length = view.getUint32(start_index, little_endian);
        start_index += 4;

        let u32_buffer = [];
        let u32_i = 0;
        while (u32_i < u32_length) {
          u32_buffer.push(view.getUint32(start_index, little_endian));
          u32_i += 1;
          start_index += 4;
        }

        arg = new Uint32Array(u32_buffer);
        break;
      default:
        throw new TypeError(
          `Unsupported Type Read From Buffer: ${tag}, ${start_index}!`
        );
    }

    return [arg, start_index];
  }
}
