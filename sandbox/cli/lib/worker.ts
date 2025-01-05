import {
  WASI,
  WASIContextOptions,
  WASIContext,
  WASIExecutionResult,
} from "@runno/wasi";

type WorkerWASIContext = Partial<
  Omit<WASIContextOptions, "stdin" | "stdout" | "stderr" | "debug">
>;

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

type DebugHostMessage = {
  target: "host";
  type: "debug";
  name: string;
  args: string[];
  ret: number;
  data: { [key: string]: any }[];
};

type ResultHostMessage = {
  target: "host";
  type: "result";
  result: WASIExecutionResult;
};

type CrashHostMessage = {
  target: "host";
  type: "crash";
  error: {
    message: string;
    type: string;
  };
};

export type HostMessage =
  | StdoutHostMessage
  | StderrHostMessage
  | DebugHostMessage
  | ResultHostMessage
  | CrashHostMessage;

(globalThis as any).onmessage = async (ev: MessageEvent) => {
  const data = ev.data as WorkerMessage;

  switch (data.type) {
    case "start":
      try {
        const result = await start(data.binaryURL, data.stdinBuffer, data);
        sendMessage({
          target: "host",
          type: "result",
          result,
        });
      } catch (e) {
        let error;
        if (e instanceof Error) {
          error = {
            message: e.message,
            type: e.constructor.name,
          };
        } else {
          error = {
            message: `unknown error - ${e}`,
            type: "Unknown",
          };
        }
        sendMessage({
          target: "host",
          type: "crash",
          error,
        });
      }

      break;
  }
};

function sendMessage(message: HostMessage) {
  (globalThis as any).postMessage(message);
}

function start(
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
      debug: sendDebug,
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

function sendDebug(
  name: string,
  args: string[],
  ret: number,
  data: { [key: string]: any }[]
) {
  // this debug data comes through as part of a message
  // we need to make sure it can be encoded by sendMessage
  data = JSON.parse(JSON.stringify(data));
  sendMessage({
    target: "host",
    type: "debug",
    name,
    args,
    ret,
    data,
  });

  // TODO: debugging WASI supports substituting a return value
  //       but it's hard to do async, so lets just always return
  //       the same value
  return ret;
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

export default class WASIWorker {
  // This is a decoy class to make the Deno type system happy
}
