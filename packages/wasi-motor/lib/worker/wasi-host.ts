import type { WASIContextOptions } from "../wasi/wasi-context";
import type { WASIExecutionResult } from "../types";
import type { HostMessage, WorkerMessage } from "./wasi-worker";

import WASIWorker from "./wasi-worker?worker&inline";

function sendMessage(worker: Worker, message: WorkerMessage) {
  worker.postMessage(message);
}

type WASIWorkerHostContext = Partial<Omit<WASIContextOptions, "stdin">>;

export class WASIWorkerHost {
  binaryURL: string;

  // 8kb should be big enough
  stdinBuffer: SharedArrayBuffer = new SharedArrayBuffer(8 * 1024);

  context: WASIWorkerHostContext;

  result?: Promise<WASIExecutionResult>;
  worker?: Worker;

  constructor(binaryURL: string, context: WASIWorkerHostContext) {
    this.binaryURL = binaryURL;
    this.context = context;
  }

  async start() {
    if (this.result) {
      throw new Error("WASIWorker Host can only be started once");
    }

    this.result = new Promise<WASIExecutionResult>((resolve, _) => {
      this.worker = new WASIWorker();

      this.worker.addEventListener("message", (messageEvent) => {
        const message: HostMessage = messageEvent.data;
        switch (message.type) {
          case "stdout":
            this.context.stdout?.(message.text);
            break;
          case "stderr":
            this.context.stderr?.(message.text);
            break;
          case "result":
            resolve(message.result);
            break;
        }
      });

      sendMessage(this.worker, {
        target: "client",
        type: "start",
        binaryURL: this.binaryURL,
        stdinBuffer: this.stdinBuffer,
        args: this.context.args,
        env: this.context.env,
        fs: this.context.fs,
      });
    });

    return this.result;
  }

  kill() {
    if (!this.worker) {
      throw new Error("WASIWorker has not started");
    }
    this.worker.terminate();
  }

  async pushStdin(data: string) {
    const view = new DataView(this.stdinBuffer);

    // Wait until the stdinbuffer is fully consumed at the other end
    // before pushing more data on.

    // first four bytes (Int32) is the length of the text
    while (view.getInt32(0) !== 0) {
      // TODO: Switch to Atomics.waitAsync when supported by firefox
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Store the encoded text offset by 4 bytes
    const encodedText = new TextEncoder().encode(data);
    const buffer = new Uint8Array(this.stdinBuffer, 4);
    buffer.set(encodedText);

    // Store how long the text is in the first 4 bytes
    view.setInt32(0, encodedText.byteLength);
    Atomics.notify(new Int32Array(this.stdinBuffer), 0);
  }

  async pushEOF() {
    const view = new DataView(this.stdinBuffer);

    // TODO: Switch to Atomics.waitAsync when supported by firefox
    while (view.getInt32(0) !== 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    view.setInt32(0, -1);
    Atomics.notify(new Int32Array(this.stdinBuffer), 0);
  }
}
