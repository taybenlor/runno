import { Result, Clock } from "./snapshot_preview1";

type WASIDrive = {
  [name: string]: WASIFile;
};

type WASIFile = {
  name: string;
  content: string | Uint8Array;
};

type Options = {
  drive: WASIDrive;
  args: string[];
  env: Record<string, string>;
  stdin: (maxByteLength: number) => string | null;
  stdout: (out: string) => void;
  stderr: (err: string) => void;
};

/**
 * WASIContext
 *
 * The context in which a WASI binary is executed.
 * This is used for syscalls that get args, environment, use IO and read/write
 * to files. This gives you programmattic access to the environment that the
 * WASI binary is executing in.
 *
 * Notes:
 *
 * stdin - string is passed as JavaScript string but encoded to UTF-8, if this
 *         ends up longer than maxByteLength it will be truncated.
 *
 */
export class WASIContext {
  drive: WASIDrive;
  args: string[];
  env: Record<string, string>;
  stdin: Options["stdin"];
  stdout: Options["stdout"];
  stderr: Options["stderr"];

  constructor(options?: Partial<Options>) {
    this.drive = options?.drive ?? {};
    this.args = options?.args ?? [];
    this.env = options?.env ?? {};

    this.stdin = options?.stdin ?? (() => null);
    this.stdout = options?.stdout ?? (() => {});
    this.stderr = options?.stderr ?? (() => {});
  }
}

class WASIExit extends Error {
  code: number;
  constructor(code: number) {
    super();

    this.code = code;
  }
}

/**
 * This implementation adapted from cloudflare/workers-wasi
 * https://github.com/cloudflare/workers-wasi/blob/main/src/index.ts
 *
 */
export class WASI {
  instance!: WebAssembly.Instance;
  module!: WebAssembly.Module;
  context: WASIContext;
  memory!: WebAssembly.Memory;

  initialized: boolean = false;

  static async start(
    wasmSource: Response | PromiseLike<Response>,
    context: WASIContext
  ) {
    const wasi = new WASI(context);
    const wasm = await WebAssembly.instantiateStreaming(wasmSource, {
      wasi_snapshot_preview1: wasi.getImports(),
    });
    wasi.init(wasm);
    return wasi.start();
  }

  constructor(context: WASIContext) {
    this.context = context;
  }

  init(wasm: WebAssembly.WebAssemblyInstantiatedSource) {
    this.instance = wasm.instance;
    this.module = wasm.module;
    this.memory = this.instance.exports.memory as WebAssembly.Memory;

    this.initialized = true;
  }

  start(): number {
    if (!this.initialized) {
      throw new Error("WASI must be initialized with init(wasm) first");
    }

    // TODO: Investigate Google's Asyncify
    // https://github.com/GoogleChromeLabs/asyncify
    // which allows for async imports/exports so we aren't
    // dependent on blocking IO

    const entrypoint = this.instance.exports._start as () => void;
    try {
      entrypoint();
    } catch (e) {
      if (e instanceof WASIExit) {
        return e.code;
      } else {
        throw e;
      }
    }

    // Nothing went wrong so this is a 0
    return 0;
  }

  getImports(): WebAssembly.ModuleImports {
    // TODO: Imports should be explicit and include only the specific WASI fields
    return {
      args_get: this.args_get.bind(this),
      args_sizes_get: this.args_sizes_get.bind(this),
      clock_res_get: this.clock_res_get.bind(this),
      clock_time_get: this.clock_time_get.bind(this),
      environ_get: this.environ_get.bind(this),
      environ_sizes_get: this.environ_sizes_get.bind(this),
      fd_write: this.fd_write.bind(this),
      proc_exit: this.proc_exit.bind(this),
    };
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
    return Result.SUCCESS;
  }

  args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number {
    writeStringArraySizesToMemory(
      this.memory,
      this.context.args,
      argc_ptr,
      argv_buf_size_ptr
    );
    return Result.SUCCESS;
  }

  clock_res_get(id: number, retptr0: number): number {
    switch (id) {
      case Clock.REALTIME:
      case Clock.MONOTONIC:
      case Clock.PROCESS_CPUTIME_ID:
      case Clock.THREAD_CPUTIME_ID: {
        const view = new DataView(this.memory.buffer);
        // TODO: Convert this to use performance.now
        view.setBigUint64(retptr0, BigInt(1e6), true);
        return Result.SUCCESS;
      }
    }
    return Result.EINVAL;
  }

  /**
   * @param id
   * @param precision
   * @param retptr0
   * @returns Result
   */
  clock_time_get(id: number, _: bigint, retptr0: number): number {
    switch (id) {
      case Clock.REALTIME:
      case Clock.MONOTONIC:
      case Clock.PROCESS_CPUTIME_ID:
      case Clock.THREAD_CPUTIME_ID: {
        const view = new DataView(this.memory.buffer);
        view.setBigUint64(retptr0, BigInt(Date.now()) * BigInt(1e6), true);
        return Result.SUCCESS;
      }
    }
    return Result.EINVAL;
  }

  environ_get(env_ptr_ptr: number, env_buf_ptr: number): number {
    writeStringArrayToMemory(
      this.memory,
      this.envArray,
      env_ptr_ptr,
      env_buf_ptr
    );
    return Result.SUCCESS;
  }

  environ_sizes_get(env_ptr: number, env_buf_size_ptr: number): number {
    writeStringArraySizesToMemory(
      this.memory,
      this.envArray,
      env_ptr,
      env_buf_size_ptr
    );
    return Result.SUCCESS;
  }

  fd_read(
    fd: number,
    iovs_ptr: number,
    iovs_len: number,
    retptr0: number
  ): number {
    // Read not supported on stdout and stderr
    if (fd === 1 || fd === 2) {
      return Result.ENOTSUP;
    }

    // Read from stdin
    if (fd === 0) {
      const view = new DataView(this.memory.buffer);
      const iovs = createIOVectors(view, iovs_ptr, iovs_len);
      const encoder = new TextEncoder();

      let bytesRead = 0;
      for (const iov of iovs) {
        // Using callbacks for a blocking call
        const input = this.context.stdin(iov.byteLength);
        if (!input) {
          break;
        }

        const data = encoder.encode(input);
        const bytes = Math.min(iov.byteLength, data.byteLength);
        iov.set(data.subarray(0, bytes));

        bytesRead += bytes;
      }

      view.setUint32(retptr0, bytesRead, true);
      return Result.SUCCESS;
    }

    // TODO: Implement reading from files other than STDIN
    return Result.ENOSYS;
  }

  fd_write(
    fd: number,
    ciovs_ptr: number,
    ciovs_len: number,
    retptr0: number
  ): number {
    // Write not supported on STDIN
    if (fd === 0) {
      return Result.ENOTSUP;
    }

    if (fd === 1 || fd === 2) {
      const stdfn = fd === 1 ? this.context.stdout : this.context.stderr;

      const view = new DataView(this.memory.buffer);
      const iovs = createIOVectors(view, ciovs_ptr, ciovs_len);
      const decoder = new TextDecoder();

      let bytesWritten = 0;
      for (const iov of iovs) {
        if (iov.byteLength === 0) {
          continue;
        }

        // We have to copy the `iov` to restrict text decoder to the bounds of
        // iov. Otherwise text decoder seems to just read all our memory.
        const output = decoder.decode(new Uint8Array(iov));
        stdfn(output);
        bytesWritten += iov.byteLength;
      }

      view.setUint32(retptr0, bytesWritten, true);

      return Result.SUCCESS;
    }

    // TODO: Implement writing to files other than STDIN
    return Result.ENOSYS;
  }

  proc_exit(code: number): void {
    throw new WASIExit(code);
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

function createIOVectors(
  view: DataView,
  iovs_ptr: number,
  iovs_len: number
): Array<Uint8Array> {
  let result = Array<Uint8Array>(iovs_len);

  for (let i = 0; i < iovs_len; i++) {
    const bufferPtr = view.getUint32(iovs_ptr, true);
    iovs_ptr += 4;

    const bufferLen = view.getUint32(iovs_ptr, true);
    iovs_ptr += 4;

    result[i] = new Uint8Array(view.buffer, bufferPtr, bufferLen);
  }
  return result;
}
