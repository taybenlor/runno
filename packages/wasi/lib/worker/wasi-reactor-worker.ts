import { WASI } from "../wasi/wasi";
import { WASIContextOptions, WASIContext } from "../wasi/wasi-context";
import { WASMArg } from "../types";

type WorkerWASIContext = Partial<
  Omit<WASIContextOptions, "stdin" | "stdout" | "stderr" | "debug">
>;

export type WASMArgMessage = {
  type: "Int32" | "Uint32" | "string" | "Int32Array" | "Uint32Array";
  data: WASMArg;
};

type InitializeWorkerMessage = {
  target: "client";
  type: "initialize";
  binaryURL: string;
  memory_start_index: number;
} & WorkerWASIContext;

type CallWorkerMessage = {
  target: "client";
  type: "call";
  call_id: number;
  method: any;
  args: WASMArgMessage[];
};

export type WorkerMessage = InitializeWorkerMessage | CallWorkerMessage;

type InitializedHostMessage = {
  target: "host";
  type: "initialized";
  // TODO Make these types stricter
  exports: any;
};

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
  call_id: number;
  memory: SharedArrayBuffer;
  err_code: number;
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
  | InitializedHostMessage
  | StdoutHostMessage
  | StderrHostMessage
  | DebugHostMessage
  | ResultHostMessage
  | CrashHostMessage;

let exports: any;
let memory_start_index: number;

onmessage = async (ev: MessageEvent) => {
  const data = ev.data as WorkerMessage;

  switch (data.type) {
    case "initialize":
      exports = await WASI.initialize(
        fetch(data.binaryURL),
        new WASIContext({
          stdout: sendStdout,
          stderr: sendStderr,
        })
      );
      memory_start_index = data.memory_start_index;
      sendMessage({
        target: "host",
        type: "initialized",
        exports: Object.keys(exports),
      });
      break;
    case "call":
      let new_arg_index: number = memory_start_index;
      data.args.forEach((arg: WASMArgMessage) => {
        new_arg_index = parseArg(arg, new_arg_index);
      });

      // Mark end of arguments list with -1
      const view = new DataView(exports.memory.buffer);
      view.setUint8(new_arg_index, -1);
      new_arg_index += 1;

      const err_code = exports[data.method].apply(null, []);

      sendMessage({
        target: "host",
        type: "result",
        call_id: data.call_id,
        memory: exports.memory.buffer,
        err_code: err_code,
      });
  }
};

function parseArg(arg: any, start_index: number) {
  // "arg" should be typed as WASMArgMessage however casting the inner
  // WASMArg to Int32 or Uint32 is undefined for some reason
  // For functionality, typing will be forgoed so that _value's can be passed
  switch (arg.type) {
    case "Int32":
      return storeInt32(arg.data._value, exports.memory.buffer, start_index);
      break;
    case "Uint32":
      return storeUint32(arg.data._value, exports.memory.buffer, start_index);
      break;
    case "string":
      return storeString(
        arg.data as string,
        exports.memory.buffer,
        start_index
      );
      break;
    case "Int32Array":
      return storeInt32Array(
        arg.data as Int32Array,
        exports.memory.buffer,
        start_index
      );
      break;
    case "Uint32Array":
      return storeUint32Array(
        arg.data as Uint32Array,
        exports.memory.buffer,
        start_index
      );
      break;
    default:
      throw new TypeError(`Unsupported Type Given: ${arg.type}!`);
  }
}

const tag_offset: number = 1;

function storeInt32(
  arg: number,
  memory: SharedArrayBuffer,
  start_index: number
) {
  // 0-1   byte  => tag of 0 for Int32 (i8)
  // 1-5   bytes => data               (i32)
  const view = new DataView(memory);
  view.setInt8(start_index, 1);
  view.setInt32(start_index + tag_offset, arg, true);

  const data_offset = 4;
  return start_index + tag_offset + data_offset;
}

function storeUint32(
  arg: number,
  memory: SharedArrayBuffer,
  start_index: number
) {
  // 0-1   byte  => tag of 1 for Uint64 (i8)
  // 1-5   bytes => data                (u32)
  const view = new DataView(memory);
  view.setInt8(start_index, 2);
  view.setUint32(start_index + tag_offset, arg, true);

  const data_offset = 4;
  return start_index + tag_offset + data_offset;
}

function storeString(
  arg: string,
  memory: SharedArrayBuffer,
  start_index: number
) {
  // 0-1             byte  => tag of 2 for string (i8)
  // 1-5             bytes => length of string    (u32)
  // 5-(5+n)         bytes => string data         (u8)
  const len_offset = 4;

  const view = new DataView(memory);
  view.setInt8(start_index, 3);

  const encodedText = new TextEncoder().encode(arg);
  const length = encodedText.byteLength;
  view.setUint32(start_index + tag_offset, length, true);

  const buffer = new Uint8Array(
    memory,
    start_index + tag_offset + len_offset,
    length
  );
  buffer.set(encodedText);

  return start_index + tag_offset + len_offset + length;
}

function storeInt32Array(
  arg: Int32Array,
  memory: SharedArrayBuffer,
  start_index: number
) {
  // 0-1               byte  => tag of 3 for Int32Array (i8)
  // 1-5               bytes => length of array         (u32)
  // 5-(5+n*4)         bytes => array data              (i32)
  const len_offset = 4;

  const view = new DataView(memory);
  view.setInt8(start_index, 4);
  view.setUint32(start_index + tag_offset, arg.byteLength / 4, true);

  let data_offset = 0;
  for (const i32 of arg) {
    view.setInt32(
      start_index + tag_offset + len_offset + data_offset,
      i32,
      true
    );
    data_offset += 4;
  }

  return start_index + tag_offset + len_offset + data_offset;
}

function storeUint32Array(
  arg: Uint32Array,
  memory: SharedArrayBuffer,
  start_index: number
) {
  // 0-1         byte  => tag of 4 for Uint64Array (i8)
  // 1-5         bytes => length of array          (u32)
  // 5-(5+n*8)   bytes => array data               (u64)
  const len_offset = 4;

  const view = new DataView(memory);
  view.setInt8(start_index, 5);
  view.setUint32(start_index + tag_offset, arg.byteLength / 4, true);

  let data_offset = 0;
  for (const u32 of arg) {
    view.setUint32(
      start_index + tag_offset + len_offset + data_offset,
      u32,
      true
    );
    data_offset += 4;
  }

  return start_index + tag_offset + len_offset + data_offset;
}

function sendMessage(message: HostMessage) {
  postMessage(message);
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
