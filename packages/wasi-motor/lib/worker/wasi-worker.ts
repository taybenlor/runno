import { WASI } from "../wasi/wasi";
import { WASIContext } from "../wasi/wasi-context";
import type { WASIExecutionResult } from "../types";

type WorkerWASIContext = Pick<WASIContext, "args" | "env" | "fs">;

type StartWorkerMessage = {
  target: "client";
  type: "start";
  binaryURL: string;
  stdinBuffer: SharedArrayBuffer;
} & WorkerWASIContext;

export type WorkerMessage = StartWorkerMessage;

type StdoutHostMessage = {
  target: "host";
  type: "stdout";
  text: string;
};

type StderrHostMessage = {
  target: "host";
  type: "stderr";
  text: string;
};

type ResultHostMessage = {
  target: "host";
  type: "result";
  result: WASIExecutionResult;
};

export type HostMessage =
  | StdoutHostMessage
  | StderrHostMessage
  | ResultHostMessage;

onmessage = async (ev: MessageEvent) => {
  const data = ev.data as WorkerMessage;

  switch (data.type) {
    case "start":
      const result = await start(data.binaryURL, data.stdinBuffer, data);
      sendMessage({
        target: "host",
        type: "result",
        result,
      });
      break;
  }
};

function sendMessage(message: HostMessage) {
  postMessage(message);
}

async function start(
  binaryURL: string,
  stdinBuffer: SharedArrayBuffer,
  context: WorkerWASIContext
) {
  return WASI.start(
    fetch(binaryURL),
    new WASIContext({
      ...context,
      stdout: sendStdout,
      stderr: sendStderr,
      stdin: (maxByteLength) => getStdin(maxByteLength, stdinBuffer),
    })
  );
}

function sendStdout(out: string) {
  sendMessage({
    target: "host",
    type: "stdout",
    text: out,
  });
}

function sendStderr(err: string) {
  sendMessage({
    target: "host",
    type: "stderr",
    text: err,
  });
}

function getStdin(
  maxByteLength: number,
  stdinBuffer: SharedArrayBuffer
): string | null {
  // Wait until the integer at the start of the buffer has a length in it
  Atomics.wait(new Int32Array(stdinBuffer), 0, 0);

  // First four bytes are a Int32 of how many bytes are in the buffer
  const view = new DataView(stdinBuffer);
  const numBytes = view.getInt32(0);
  if (numBytes < 0) {
    view.setInt32(0, 0);
    return null;
  }

  const buffer = new Uint8Array(stdinBuffer, 4, numBytes);

  // Decode the buffer into text, but only as much as was asked for
  const returnValue = new TextDecoder().decode(buffer.slice(0, maxByteLength));

  // Rewrite the buffer with the remaining bytes
  const remaining = buffer.slice(maxByteLength, buffer.length);
  view.setInt32(0, remaining.byteLength);
  buffer.set(remaining);

  return returnValue;
}
