import * as WASIStandard from "./snapshot_preview1";

type WASIDrive = {
  [name: string]: WASIFile;
};

type WASIFile = {
  name: string;
  content: string | Uint8Array;
};

type Options = {
  args: string[];
  env: Record<string, string>;
};

type Pointer<T> = number;
type Size = void;

export class WASIContext {
  drive: WASIDrive;
  args: string[] = [];
  env: Record<string, string> = {};

  constructor(drive: WASIDrive, options?: Options) {
    this.drive = drive;
    this.args = options?.args ?? [];
    this.env = options?.env ?? {};
  }
}

/**
 * This implementation adapted from cloudflare/workers-wasi
 * https://github.com/cloudflare/workers-wasi/blob/main/src/index.ts
 *
 */
export class WASI {
  instance: WebAssembly.Instance;
  module: WebAssembly.Module;
  context: WASIContext;
  memory: WebAssembly.Memory;

  static start(
    wasm: WebAssembly.WebAssemblyInstantiatedSource,
    context: WASIContext
  ) {
    const wasi = new WASI(wasm, context);
    return wasi.start();
  }

  constructor(
    wasm: WebAssembly.WebAssemblyInstantiatedSource,
    context: WASIContext
  ) {
    this.instance = wasm.instance;
    this.module = wasm.module;
    this.context = context;
    this.memory = this.instance.exports.memory as WebAssembly.Memory;
  }

  start(): number {
    // TODO: Investigate Google's Asyncify
    // https://github.com/GoogleChromeLabs/asyncify
    // which allows for async imports/exports so we aren't
    // dependent on blocking IO

    const entrypoint = this.instance.exports._start as () => number;
    return entrypoint();
  }

  getImports(): WebAssembly.Imports {
    return {};
  }

  //
  // Helpers
  //

  get envArray(): Array<string> {
    return Object.keys(this.context.env).map((key) => {
      return `${key}=${this.context.env[key]}`;
    });
  }

  //
  // WASI Implementation
  //

  // TODO: Investigate importing types from AssemblyScript
  //
  // https://github.com/AssemblyScript/assemblyscript/blob/main/std/assembly/bindings/wasi_snapshot_preview1.ts

  args_get(argv_ptr_ptr: number, argv_buf_ptr: number): number {
    writeStringArrayToMemory(
      this.memory,
      this.context.args,
      argv_ptr_ptr,
      argv_buf_ptr
    );
    return WASIStandard.Result.SUCCESS;
  }

  args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number {
    writeStringArraySizesToMemory(
      this.memory,
      this.context.args,
      argc_ptr,
      argv_buf_size_ptr
    );
    return WASIStandard.Result.SUCCESS;
  }

  clock_res_get(id: number, retptr0: number): number {
    switch (id) {
      case WASIStandard.Clock.REALTIME:
      case WASIStandard.Clock.MONOTONIC:
      case WASIStandard.Clock.PROCESS_CPUTIME_ID:
      case WASIStandard.Clock.THREAD_CPUTIME_ID: {
        const view = new DataView(this.memory.buffer);
        // TODO: Convert this to use performance.now
        view.setBigUint64(retptr0, BigInt(1e6), true);
        return WASIStandard.Result.SUCCESS;
      }
    }
    return WASIStandard.Result.EINVAL;
  }

  clock_time_get(id: number, precision: bigint, retptr0: number): number {
    // TODO: Implement this more correctly?
    switch (id) {
      case WASIStandard.Clock.REALTIME:
      case WASIStandard.Clock.MONOTONIC:
      case WASIStandard.Clock.PROCESS_CPUTIME_ID:
      case WASIStandard.Clock.THREAD_CPUTIME_ID: {
        const view = new DataView(this.memory.buffer);
        // TODO: Convert this to use performance.now
        view.setBigUint64(retptr0, BigInt(Date.now()) * BigInt(1e6), true);
        return WASIStandard.Result.SUCCESS;
      }
    }
    return WASIStandard.Result.EINVAL;
  }

  environ_get(env_ptr_ptr: number, env_buf_ptr: number): number {
    writeStringArrayToMemory(
      this.memory,
      this.envArray,
      env_ptr_ptr,
      env_buf_ptr
    );
    return WASIStandard.Result.SUCCESS;
  }

  environ_sizes_get(env_ptr: number, env_buf_size_ptr: number): number {
    writeStringArraySizesToMemory(
      this.memory,
      this.envArray,
      env_ptr,
      env_buf_size_ptr
    );
    return WASIStandard.Result.SUCCESS;
  }
}

function writeStringArrayToMemory(
  memory: WebAssembly.Memory,
  values: Array<string>,
  iter_ptr_ptr: number,
  buf_ptr: number
): void {
  const encoder = new TextEncoder();
  const buffer = new Uint8Array(memory.buffer);

  const view = new DataView(memory.buffer);
  for (const value of values) {
    view.setUint32(iter_ptr_ptr, buf_ptr, true);
    iter_ptr_ptr += 4;

    const data = encoder.encode(`${value}\0`);
    buffer.set(data, buf_ptr);
    buf_ptr += data.length;
  }
}

function writeStringArraySizesToMemory(
  memory: WebAssembly.Memory,
  values: Array<string>,
  count_ptr: number,
  buffer_size_ptr: number
): void {
  const view = new DataView(memory.buffer);
  const encoder = new TextEncoder();
  const len = values.reduce((acc, value) => {
    return acc + encoder.encode(`${value}\0`).length;
  }, 0);

  view.setUint32(count_ptr, values.length, true);
  view.setUint32(buffer_size_ptr, len, true);
}
