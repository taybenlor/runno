import type { WASIContextOptions } from "../wasi/wasi-context";
import type { WASIExecutionResult } from "../types";
import type { HostMessage, WorkerMessage } from "./wasi-worker";

import WASIWorker from "./wasi-worker?worker&inline";

function sendMessage(worker: Worker, message: WorkerMessage) {
  worker.postMessage(message);
}

type WASIWorkerHostContext = Omit<WASIContextOptions, "stdin">;

export class WASIWorkerHost {
  binaryURL: string;
  stdinBuffer: SharedArrayBuffer;
  context: WASIWorkerHostContext;

  result?: Promise<WASIExecutionResult>;
  worker?: Worker;

  constructor(
    binaryURL: string,
    stdinBuffer: SharedArrayBuffer,
    context: WASIWorkerHostContext
  ) {
    this.binaryURL = binaryURL;
    this.stdinBuffer = stdinBuffer;
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
            this.context.stdout(message.text);
            break;
          case "stderr":
            this.context.stderr(message.text);
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
}
