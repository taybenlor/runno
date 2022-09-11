import type { WASIContext, WASIExecutionResult } from "@runno/wasi-motor";
import type { HostMessage, WorkerMessage } from "./wasi-worker";

import WASIWorker from "./wasi-worker?worker";

function sendMessage(worker: Worker, message: WorkerMessage) {
  worker.postMessage(message);
}

export async function startWithSharedBuffer(
  binaryURL: string,
  stdinBuffer: SharedArrayBuffer,
  context: WASIContext
) {
  return new Promise<WASIExecutionResult>((resolve, _) => {
    const worker = new WASIWorker();

    worker.addEventListener("message", (messageEvent) => {
      const message: HostMessage = messageEvent.data;
      switch (message.type) {
        case "stdout":
          context.stdout(message.text);
          break;
        case "stderr":
          context.stderr(message.text);
          break;
        case "result":
          resolve(message.result);
          break;
      }
    });

    sendMessage(worker, {
      target: "client",
      type: "start",
      binaryURL,
      stdinBuffer,
      args: context.args,
      env: context.env,
      fs: context.fs,
    });
  });
}
