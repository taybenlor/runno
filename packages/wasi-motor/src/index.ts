type WASMBinary = ArrayBuffer | ReturnType<typeof fetch>;

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
  // WASI Implementation
  //

  // TODO: Investigate importing types from AssemblyScript
  //
  // https://github.com/AssemblyScript/assemblyscript/blob/main/std/assembly/bindings/wasi_snapshot_preview1.ts

  args_get(argv: number, argv_buf: number): number {}

  args_sizes_get(arg_count: Pointer<Size>, argv_buf_size: Pointer<Size>) {}
}
