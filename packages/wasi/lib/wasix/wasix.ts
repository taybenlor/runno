import {
  ClockId,
  DIRENT_SIZE,
  FDSTAT_SIZE,
  FILESTAT_SIZE,
  FileType,
  PRESTAT_SIZE,
  PreopenType,
  Result,
  WASIXError,
} from "./wasix-32v1.js";
import { WASIXContext, WASIXContextOptions } from "./wasix-context.js";
import {
  WASI,
  InvalidInstanceError,
  InitializationError,
} from "../wasi/wasi.js";
import { WASIContextOptions } from "../wasi/wasi-context.js";
import { WASIXExecutionResult } from "../types.js";
import { SystemClockProvider } from "./providers/system-clock.js";
import { SystemRandomProvider } from "./providers/system-random.js";
import { WASIDriveFileSystemProvider } from "./providers/ergonomic/filesystem-provider.js";
import type {
  ClockProvider,
  FileSystemProvider,
  RandomProvider,
} from "./providers.js";
import {
  ParsedEnvImports,
  parseEnvImportDescriptors,
  validateMemoryOverride,
  validateTableOverride,
} from "./module-imports.js";
import { resolveAbsolute, stripLeadingSlash } from "./path-utils.js";

class WASIXExit extends Error {
  code: number;
  constructor(code: number) {
    super();
    this.code = code;
  }
}

// One-shot warning: emitted on first construction when the host page is
// not cross-origin-isolated. wasix-libc binaries import a shared
// `env.memory`, which `WebAssembly.instantiate` rejects without
// `crossOriginIsolated`. Without this hint the failure looks like a
// generic "imported memory: shared but env doesn't allow shared memory"
// error from the engine.
let warnedNotCrossOriginIsolated = false;

/**
 * WASIX runtime for the browser.
 *
 * Sibling of WASI (not a subclass). Composes a WASI instance internally
 * to service wasi_snapshot_preview1 and wasi_unstable imports.
 * Filesystem syscalls route through a `FileSystemProvider`; clock and
 * random go through their respective providers. Memory marshalling lives
 * in this class — providers only ever see decoded JS-native values.
 *
 * Usage mirrors WASI.start():
 *
 *   const result = await WASIX.start(fetch('/bin/hello.wasm'), new WASIXContext({ … }));
 */
export class WASIX {
  instance!: WebAssembly.Instance;
  module!: WebAssembly.Module;
  memory!: WebAssembly.Memory;
  context: WASIXContext;
  hasBeenInitialized: boolean = false;

  private wasi: WASI;
  private _clock?: ClockProvider;
  private _random?: RandomProvider;

  /**
   * Current working directory as an absolute, normalised path. Mutated
   * by `chdir`, read by `getcwd`. Default `/home` mirrors wasix-libc's
   * compiled-in default (the wasmer runner mounts the test dir there).
   */
  private cwd: string = "/home";

  /**
   * Start a WASIX command.
   *
   * Buffers the module bytes so we can parse the import section
   * ourselves: `WebAssembly.Module.imports(module)` returns only the
   * `{ module, name, kind }` triple — descriptors (memory limits,
   * shared flag, table element type) are not in the standard surface.
   * We need those to construct a matching `WebAssembly.Memory` /
   * `WebAssembly.Table` for `env.memory` / `env.__indirect_function_table`,
   * so the parse runs over the raw bytes before compile.
   */
  static async start(
    wasmSource: Response | PromiseLike<Response>,
    context: Partial<WASIXContextOptions> = {},
  ): Promise<WASIXExecutionResult> {
    const wasix = new WASIX(context);
    const response = await wasmSource;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const envDescriptors = parseEnvImportDescriptors(bytes);
    const { memory, indirectFunctionTable } =
      wasix.resolveEnvImports(envDescriptors);
    const module = await WebAssembly.compile(bytes);
    const imports = wasix.getImportObject({ memory, indirectFunctionTable });
    const instance = await WebAssembly.instantiate(module, imports);
    return wasix.start({ module, instance }, { memory });
  }

  constructor(context: Partial<WASIXContextOptions>) {
    this.context = new WASIXContext(context);

    if (
      !warnedNotCrossOriginIsolated &&
      typeof globalThis !== "undefined" &&
      (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated ===
        false
    ) {
      warnedNotCrossOriginIsolated = true;
      console.warn(
        "WASIX: page is not cross-origin-isolated; shared-memory imports " +
          "will fail at WebAssembly.instantiate. Configure COOP " +
          "(`Cross-Origin-Opener-Policy: same-origin`) and COEP " +
          "(`Cross-Origin-Embedder-Policy: require-corp`) on the host page.",
      );
    }
    // The internal WASI shares args / env / stdio with WASIX. wasix-libc
    // binaries reach for both `wasix_32v1` and `wasi_snapshot_preview1`
    // filesystem imports — preopen discovery (`fd_prestat_get`) lives in
    // preview1 — so the inner WASI must see the same drive as the WASIX
    // FileSystemProvider, not a separate empty drive. When the host hands
    // us the bundled `WASIDriveFileSystemProvider` we reuse its drive
    // directly; for opaque providers the inner preview1 fs stays empty
    // (those hosts shouldn't have wasix-libc binaries reaching for
    // preview1 fs in the first place).
    const wasiContext: Partial<WASIContextOptions> = {
      args: context.args,
      env: context.env,
      stdin: context.stdin,
      stdout: context.stdout,
      stderr: context.stderr,
      isTTY: context.isTTY,
      debug: context.debug,
      fs: {},
    };
    this.wasi = new WASI(wasiContext);
    if (this.context.fs instanceof WASIDriveFileSystemProvider) {
      this.wasi.drive = this.context.fs.drive;
    }
  }

  /**
   * Convert the parsed `env.*` import descriptors into concrete
   * `WebAssembly.Memory` / `WebAssembly.Table` instances, honouring any
   * host overrides on the context. Either result may be undefined when
   * the binary doesn't import the corresponding entry (preview1-style
   * binaries that export their own memory, for example).
   */
  resolveEnvImports(descriptors: ParsedEnvImports): {
    memory?: WebAssembly.Memory;
    indirectFunctionTable?: WebAssembly.Table;
  } {
    let memory: WebAssembly.Memory | undefined;
    let indirectFunctionTable: WebAssembly.Table | undefined;

    if (descriptors.memory) {
      const { initial, maximum, shared } = descriptors.memory;
      const override = this.context.memory;
      if (override) {
        validateMemoryOverride(override, { initial, maximum, shared });
        memory = override;
      } else {
        memory = new WebAssembly.Memory({
          initial,
          ...(maximum !== undefined ? { maximum } : {}),
          ...(shared ? { shared: true } : {}),
        } as WebAssembly.MemoryDescriptor);
      }
    }

    if (descriptors.table) {
      const { element, initial, maximum } = descriptors.table;
      const override = this.context.indirectFunctionTable;
      if (override) {
        validateTableOverride(override, { element, initial, maximum });
        indirectFunctionTable = override;
      } else {
        indirectFunctionTable = new WebAssembly.Table({
          element,
          initial,
          ...(maximum !== undefined ? { maximum } : {}),
        } as WebAssembly.TableDescriptor);
      }
    }

    return { memory, indirectFunctionTable };
  }

  getImportObject(
    env: {
      memory?: WebAssembly.Memory;
      indirectFunctionTable?: WebAssembly.Table;
    } = {},
  ) {
    const preview1 = this.wasi.getImports("preview1", this.context.debug);
    const unstable = this.wasi.getImports("unstable", this.context.debug);

    // Override proc_exit in both preview1 and unstable so that WASIXExit
    // is thrown instead of WASIExit (which is private to wasi.ts).
    const procExit = (code: number) => {
      throw new WASIXExit(code);
    };

    const envImports: WebAssembly.ModuleImports = {};
    if (env.memory) envImports.memory = env.memory;
    if (env.indirectFunctionTable)
      envImports.__indirect_function_table = env.indirectFunctionTable;

    // wasix-libc binaries discover preopens via preview1's
    // `fd_prestat_get` / `fd_prestat_dir_name`, not the wasix_32v1
    // surface. Override the preview1 entries so the FS provider's
    // preopen map (e.g. fd 4 = "/home") is visible to the libc startup
    // walk; otherwise it stops after fd 3 and never finds /home.
    //
    // Path ops are also routed through the FS provider when libc
    // happens to import the preview1 entry instead of the wasix_32v1
    // one. wasix-libc 0.4.3 does this for `rmdir` (preview1
    // `path_remove_directory`); the preview1 stub in wasi.ts returns
    // ENOSYS, so without this override `rmdir` always fails even
    // though the drive can perform it. Mirror the syscalls that have
    // a richer semantics in the provider (e.g. ENOTEMPTY checks).
    // wasix-libc reaches into preview1 for several path/fd ops even
    // when the binary is otherwise wasix_32v1 (rmdir → preview1
    // `path_remove_directory`, stat → preview1 `path_filestat_get`,
    // readdir → preview1 `fd_readdir`). The preview1 impls in wasi.ts
    // call the drive directly and return its raw error vocabulary
    // (e.g. ENOTCAPABLE for "not present") and don't synthesize the
    // POSIX-shaped readdir entries (`.` / `..`, no `.runno`). Route
    // them through the WASIX provider so the translation is uniform.
    const preview1Overrides = {
      ...preview1,
      proc_exit: procExit,
      fd_prestat_get: this.wasix_fd_prestat_get.bind(this),
      fd_prestat_dir_name: this.wasix_fd_prestat_dir_name.bind(this),
      fd_readdir: this.wasix_fd_readdir.bind(this),
      path_filestat_get: this.wasix_path_filestat_get.bind(this),
      path_open: this.wasix_path_open.bind(this),
      path_create_directory: this.wasix_path_create_directory.bind(this),
      path_remove_directory: this.wasix_path_remove_directory.bind(this),
      path_unlink_file: this.wasix_path_unlink_file.bind(this),
      path_rename: this.wasix_path_rename.bind(this),
    };
    return {
      env: envImports,
      wasix_32v1: this.getWasix32v1Imports(),
      wasi_snapshot_preview1: preview1Overrides,
      wasi_unstable: { ...unstable, proc_exit: procExit },
    };
  }

  /**
   * Start a WASIX command.
   *
   * See: https://github.com/WebAssembly/WASI/blob/main/legacy/application-abi.md
   */
  start(
    wasm: WebAssembly.WebAssemblyInstantiatedSource,
    options: {
      memory?: WebAssembly.Memory;
    } = {},
  ): WASIXExecutionResult {
    if (this.hasBeenInitialized) {
      throw new InitializationError(
        "This instance has already been initialized",
      );
    }

    this.hasBeenInitialized = true;
    this.instance = wasm.instance;
    this.module = wasm.module;
    this.memory =
      options.memory ?? (this.instance.exports.memory as WebAssembly.Memory);

    // Wire the internal WASI instance to the same wasm instance + memory
    // so that preview1/unstable syscalls can access guest memory.
    this.wasi.instance = wasm.instance;
    this.wasi.module = wasm.module;
    this.wasi.memory = this.memory;
    this.wasi.hasBeenInitialized = true;

    if ("_initialize" in this.instance.exports) {
      throw new InvalidInstanceError(
        "WebAssembly instance is a reactor and should be started with initialize.",
      );
    }

    if (!("_start" in this.instance.exports)) {
      throw new InvalidInstanceError(
        "WebAssembly instance doesn't export _start, it may not be WASI or may be a Reactor.",
      );
    }

    const entrypoint = this.instance.exports._start as () => void;
    try {
      entrypoint();
    } catch (e) {
      if (e instanceof WASIXExit) {
        return { exitCode: e.code };
      } else if (e instanceof WebAssembly.RuntimeError) {
        return { exitCode: 134 };
      } else {
        throw e;
      }
    }

    return { exitCode: 0 };
  }

  //
  // Provider accessors — lazy-init defaults when context slot is unset.
  //

  private get clock(): ClockProvider {
    return this.context.clock ?? (this._clock ??= new SystemClockProvider());
  }

  private get random(): RandomProvider {
    return this.context.random ?? (this._random ??= new SystemRandomProvider());
  }

  private get fs(): FileSystemProvider {
    return this.context.fs;
  }

  //
  // wasix_32v1 syscall handlers — clock / random / filesystem wired.
  //

  private wasix_clock_time_get(
    id: number,
    _precision: bigint,
    retptr: number,
  ): number {
    try {
      const view = new DataView(this.memory.buffer);
      view.setBigUint64(retptr, this.clock.now(id as ClockId), true);
      return Result.SUCCESS;
    } catch (e) {
      if (e instanceof WASIXError) return e.result;
      this.context.debug?.("clock_time_get", [], Result.EIO, [
        { error: String(e) },
      ]);
      return Result.EIO;
    }
  }

  private wasix_clock_res_get(id: number, retptr: number): number {
    try {
      const view = new DataView(this.memory.buffer);
      view.setBigUint64(retptr, this.clock.resolution(id as ClockId), true);
      return Result.SUCCESS;
    } catch (e) {
      if (e instanceof WASIXError) return e.result;
      this.context.debug?.("clock_res_get", [], Result.EIO, [
        { error: String(e) },
      ]);
      return Result.EIO;
    }
  }

  private wasix_random_get(bufPtr: number, bufLen: number): number {
    try {
      const buf = new Uint8Array(this.memory.buffer, bufPtr, bufLen);
      this.random.fill(buf);
      return Result.SUCCESS;
    } catch (e) {
      if (e instanceof WASIXError) return e.result;
      this.context.debug?.("random_get", [], Result.EIO, [
        { error: String(e) },
      ]);
      return Result.EIO;
    }
  }

  //
  // Filesystem syscalls
  //

  private wasix_fd_read(
    fd: number,
    iovsPtr: number,
    iovsLen: number,
    retptr: number,
  ): number {
    try {
      // STDIO routes through the internal WASI so stdin/out callbacks stay in
      // one place. Any non-stdio fd goes through the provider.
      if (fd === 0 || fd === 1 || fd === 2) {
        return this.wasi.fd_read(fd, iovsPtr, iovsLen, retptr);
      }
      const view = new DataView(this.memory.buffer);
      const iovs = readIOVectors(view, iovsPtr, iovsLen);
      const bytesRead = this.fs.fdRead(fd, iovs);
      view.setUint32(retptr, bytesRead, true);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_read");
    }
  }

  private wasix_fd_write(
    fd: number,
    ciovsPtr: number,
    ciovsLen: number,
    retptr: number,
  ): number {
    try {
      if (fd === 0 || fd === 1 || fd === 2) {
        return this.wasi.fd_write(fd, ciovsPtr, ciovsLen, retptr);
      }
      const view = new DataView(this.memory.buffer);
      const iovs = readIOVectors(view, ciovsPtr, ciovsLen);
      const bytesWritten = this.fs.fdWrite(fd, iovs);
      view.setUint32(retptr, bytesWritten, true);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_write");
    }
  }

  private wasix_fd_seek(
    fd: number,
    offset: bigint,
    whence: number,
    retptr: number,
  ): number {
    try {
      const newOffset = this.fs.fdSeek(fd, offset, whence);
      const view = new DataView(this.memory.buffer);
      view.setBigUint64(retptr, newOffset, true);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_seek");
    }
  }

  private wasix_fd_close(fd: number): number {
    try {
      this.fs.fdClose(fd);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_close");
    }
  }

  private wasix_fd_fdstat_get(fd: number, retptr: number): number {
    try {
      // STDIO still uses the internal WASI for stdio-specific fdstat shape.
      if (fd < 3) {
        return this.wasi.fd_fdstat_get(fd, retptr);
      }
      const stat = this.fs.fdFdstatGet(fd);
      const buffer = encodeFdstat(stat);
      new Uint8Array(this.memory.buffer, retptr, buffer.byteLength).set(buffer);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_fdstat_get");
    }
  }

  private wasix_fd_fdstat_set_flags(fd: number, flags: number): number {
    try {
      this.fs.fdFdstatSetFlags(fd, flags);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_fdstat_set_flags");
    }
  }

  private wasix_fd_filestat_get(fd: number, retptr: number): number {
    try {
      if (fd < 3) {
        return this.wasi.fd_filestat_get(fd, retptr);
      }
      const stat = this.fs.fdFilestatGet(fd);
      const buffer = encodeFilestat(stat);
      new Uint8Array(this.memory.buffer, retptr, buffer.byteLength).set(buffer);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_filestat_get");
    }
  }

  private wasix_fd_prestat_get(fd: number, retptr: number): number {
    try {
      const info = this.fs.fdPrestatGet(fd);
      if (info === null) {
        return Result.EBADF;
      }
      const view = new DataView(this.memory.buffer, retptr, PRESTAT_SIZE);
      view.setUint8(0, PreopenType.DIR);
      view.setUint32(4, new TextEncoder().encode(info.name).byteLength, true);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_prestat_get");
    }
  }

  private wasix_fd_prestat_dir_name(
    fd: number,
    pathPtr: number,
    pathLen: number,
  ): number {
    try {
      const name = this.fs.fdPrestatDirName(fd);
      const bytes = new TextEncoder().encode(name);
      const dst = new Uint8Array(this.memory.buffer, pathPtr, pathLen);
      dst.set(bytes.subarray(0, pathLen));
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_prestat_dir_name");
    }
  }

  private wasix_fd_readdir(
    fd: number,
    bufPtr: number,
    bufLen: number,
    cookie: bigint,
    retptr: number,
  ): number {
    try {
      const entries = this.fs.fdReaddir(fd, cookie);
      const encoded = encodeDirectoryEntries(entries);
      const dst = new Uint8Array(this.memory.buffer, bufPtr, bufLen);
      const toWrite = encoded.subarray(0, bufLen);
      dst.set(toWrite);
      new DataView(this.memory.buffer).setUint32(
        retptr,
        toWrite.byteLength,
        true,
      );
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "fd_readdir");
    }
  }

  private wasix_path_open(
    fdDir: number,
    dirflags: number,
    pathPtr: number,
    pathLen: number,
    oflags: number,
    rightsBase: bigint,
    rightsInheriting: bigint,
    fdflags: number,
    retptr: number,
  ): number {
    try {
      const path = readString(this.memory, pathPtr, pathLen);
      const newFd = this.fs.pathOpen(
        fdDir,
        dirflags,
        path,
        oflags,
        rightsBase,
        rightsInheriting,
        fdflags,
      );
      new DataView(this.memory.buffer).setUint32(retptr, newFd, true);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "path_open");
    }
  }

  // path_open2 is the wasix v2 variant: same as preview1 path_open
  // plus an extended fdflags2 word (the last i32 before retptr). The
  // extra flag bits are not yet modelled, but ignoring them and routing
  // through the existing pathOpen unblocks every wasix-libc binary
  // that calls open()/opendir() — those use path_open2 unconditionally.
  // TODO(slice-9): honour fdflags2 once the fd-table extraction surfaces
  //   semantics for the new bits (close-on-exec etc.).
  private wasix_path_open2(
    fdDir: number,
    dirflags: number,
    pathPtr: number,
    pathLen: number,
    oflags: number,
    rightsBase: bigint,
    rightsInheriting: bigint,
    fdflags: number,
    _fdflags2: number,
    retptr: number,
  ): number {
    try {
      const path = readString(this.memory, pathPtr, pathLen);
      const newFd = this.fs.pathOpen(
        fdDir,
        dirflags,
        path,
        oflags,
        rightsBase,
        rightsInheriting,
        fdflags,
      );
      new DataView(this.memory.buffer).setUint32(retptr, newFd, true);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "path_open2");
    }
  }

  private wasix_path_filestat_get(
    fdDir: number,
    dirflags: number,
    pathPtr: number,
    pathLen: number,
    retptr: number,
  ): number {
    try {
      const path = readString(this.memory, pathPtr, pathLen);
      const stat = this.fs.pathFilestatGet(fdDir, dirflags, path);
      const buffer = encodeFilestat(stat);
      new Uint8Array(this.memory.buffer, retptr, buffer.byteLength).set(buffer);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "path_filestat_get");
    }
  }

  private wasix_path_create_directory(
    fdDir: number,
    pathPtr: number,
    pathLen: number,
  ): number {
    try {
      const path = readString(this.memory, pathPtr, pathLen);
      this.fs.pathCreateDirectory(fdDir, path);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "path_create_directory");
    }
  }

  private wasix_path_unlink_file(
    fdDir: number,
    pathPtr: number,
    pathLen: number,
  ): number {
    try {
      const path = readString(this.memory, pathPtr, pathLen);
      this.fs.pathUnlinkFile(fdDir, path);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "path_unlink_file");
    }
  }

  private wasix_path_remove_directory(
    fdDir: number,
    pathPtr: number,
    pathLen: number,
  ): number {
    try {
      const path = readString(this.memory, pathPtr, pathLen);
      this.fs.pathRemoveDirectory(fdDir, path);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "path_remove_directory");
    }
  }

  //
  // Working directory — getcwd / chdir. wasix-libc binaries call these
  // directly; preview1 has no cwd surface. wasix-libc's `__wasilibc_resolve_path`
  // reads getcwd to turn relative paths absolute before walking the
  // preopen table, so the cwd lives entirely as runtime state — there is
  // no per-syscall cwd-relative resolution further down the path stack.
  //
  // ABI:
  //   getcwd(path_buf: *mut u8, path_buf_len: *mut u32) -> errno
  //     - On entry, *path_buf_len is the buffer's capacity.
  //     - On exit, *path_buf_len is set to the cwd's byte length and
  //       up to that many bytes are copied into path_buf. EOVERFLOW is
  //       returned (and the length is still written) when the buffer is
  //       too small, mirroring upstream wasmer behaviour so callers can
  //       grow the buffer and retry.
  //   chdir(path: *const u8, path_len: u32) -> errno
  //     - The string is treated as either absolute or relative-to-cwd
  //       and validated by checking that the resolved path lives under
  //       a known preopen and resolves to a directory in the FS provider.
  //

  private wasix_getcwd(pathBufPtr: number, pathLenPtr: number): number {
    try {
      const view = new DataView(this.memory.buffer);
      const maxLen = view.getUint32(pathLenPtr, true);
      const bytes = new TextEncoder().encode(this.cwd);
      // Always write the actual length first — upstream wasmer does the
      // same so callers can retry with a larger buffer after EOVERFLOW.
      view.setUint32(pathLenPtr, bytes.byteLength, true);
      if (bytes.byteLength > maxLen) {
        return Result.EOVERFLOW;
      }
      new Uint8Array(this.memory.buffer, pathBufPtr, bytes.byteLength).set(
        bytes,
      );
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "getcwd");
    }
  }

  private wasix_chdir(pathPtr: number, pathLen: number): number {
    try {
      const path = readString(this.memory, pathPtr, pathLen);
      const resolved = resolveAbsolute(this.cwd, path);
      const match = this.findPreopenFor(resolved);
      if (match === null) {
        return Result.ENOENT;
      }
      // The preopen root itself is always a directory; only validate
      // when there's a non-trivial relative component to look up.
      if (match.relativePath !== "" && match.relativePath !== ".") {
        const stat = this.fs.pathFilestatGet(match.fd, 0, match.relativePath);
        if (stat.filetype !== FileType.DIRECTORY) {
          return Result.ENOTDIR;
        }
      }
      this.cwd = resolved;
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "chdir");
    }
  }

  /**
   * Find which preopen owns an absolute path. Iterates fds starting at
   * 3 until `fdPrestatGet` returns null, picking the longest matching
   * preopen name so nested mounts (e.g. "/home" vs "/") resolve to the
   * more specific fd. The "." preopen is treated as the implicit root
   * — it matches every absolute path but loses to any named match.
   */
  private findPreopenFor(
    absPath: string,
  ): { fd: number; relativePath: string } | null {
    let best: { fd: number; relativePath: string; nameLen: number } | null =
      null;
    for (let fd = 3; fd < 256; fd++) {
      const info = this.fs.fdPrestatGet(fd);
      if (info === null) break;
      const name = info.name;
      if (name === "." || name === "/") {
        if (best === null) {
          best = {
            fd,
            relativePath: stripLeadingSlash(absPath),
            nameLen: 0,
          };
        }
        continue;
      }
      if (absPath === name) {
        if (best === null || best.nameLen < name.length) {
          best = { fd, relativePath: ".", nameLen: name.length };
        }
        continue;
      }
      if (absPath.startsWith(name + "/")) {
        if (best === null || best.nameLen < name.length) {
          best = {
            fd,
            relativePath: absPath.slice(name.length + 1),
            nameLen: name.length,
          };
        }
      }
    }
    return best;
  }

  private wasix_path_rename(
    oldFd: number,
    oldPathPtr: number,
    oldPathLen: number,
    newFd: number,
    newPathPtr: number,
    newPathLen: number,
  ): number {
    try {
      const oldPath = readString(this.memory, oldPathPtr, oldPathLen);
      const newPath = readString(this.memory, newPathPtr, newPathLen);
      this.fs.pathRename(oldFd, oldPath, newFd, newPath);
      return Result.SUCCESS;
    } catch (e) {
      return mapError(e, this.context.debug, "path_rename");
    }
  }

  private getWasix32v1Imports(): WebAssembly.ModuleImports {
    const enosys = () => Result.ENOSYS;
    // proc_exit2 mirrors proc_exit semantics: terminate the run with the
    // supplied code. wasix-libc's exit path always goes through proc_exit2;
    // proc_exit (v1) is left wired ENOSYS until a binary surfaces it.
    const procExit2 = (code: number) => {
      throw new WASIXExit(code);
    };
    return {
      // Args / environ — share the internal WASI's preview1 implementations
      // so wasix-libc's argv/environ setup sees the values that were passed
      // to the WASIXContext.
      args_get: this.wasi.args_get.bind(this.wasi),
      args_sizes_get: this.wasi.args_sizes_get.bind(this.wasi),
      environ_get: this.wasi.environ_get.bind(this.wasi),
      environ_sizes_get: this.wasi.environ_sizes_get.bind(this.wasi),

      // Clock
      clock_res_get: this.wasix_clock_res_get.bind(this),
      clock_time_get: this.wasix_clock_time_get.bind(this),

      // File descriptors
      fd_advise: enosys,
      fd_allocate: enosys,
      fd_close: this.wasix_fd_close.bind(this),
      fd_datasync: enosys,
      fd_dup: enosys,
      fd_event: enosys,
      fd_fdstat_get: this.wasix_fd_fdstat_get.bind(this),
      fd_fdstat_set_flags: this.wasix_fd_fdstat_set_flags.bind(this),
      fd_fdstat_set_rights: enosys,
      fd_filestat_get: this.wasix_fd_filestat_get.bind(this),
      fd_filestat_set_size: enosys,
      fd_filestat_set_times: enosys,
      fd_pread: enosys,
      fd_prestat_dir_name: this.wasix_fd_prestat_dir_name.bind(this),
      fd_prestat_get: this.wasix_fd_prestat_get.bind(this),
      fd_pwrite: enosys,
      fd_read: this.wasix_fd_read.bind(this),
      fd_readdir: this.wasix_fd_readdir.bind(this),
      fd_renumber: enosys,
      fd_seek: this.wasix_fd_seek.bind(this),
      fd_sync: enosys,
      fd_tell: enosys,
      fd_write: this.wasix_fd_write.bind(this),
      fd_pipe: enosys,

      // wasix_32v1 v2 fd surface — flag-extended variants. Stubbed
      // ENOSYS until the fd-table extraction (Slice 9) lifts the
      // backing semantics out of WASIDrive.
      fd_dup2: enosys, // TODO(slice-9): alias of fd_renumber
      fd_fdflags_get: enosys, // TODO(slice-9): mirrors fd_fdstat_get fs_flags
      fd_fdflags_set: enosys, // TODO(slice-9): mirrors fd_fdstat_set_flags

      // Paths
      path_create_directory: this.wasix_path_create_directory.bind(this),
      path_filestat_get: this.wasix_path_filestat_get.bind(this),
      path_filestat_set_times: enosys,
      path_link: enosys,
      path_open: this.wasix_path_open.bind(this),
      path_open2: this.wasix_path_open2.bind(this),
      path_readlink: enosys,
      path_remove_directory: this.wasix_path_remove_directory.bind(this),
      path_rename: this.wasix_path_rename.bind(this),
      path_symlink: enosys,
      path_unlink_file: this.wasix_path_unlink_file.bind(this),

      // Process
      proc_exit: enosys,
      proc_exit2: procExit2,
      proc_fork: enosys,
      proc_fork_env: enosys, // TODO(slice-7): proc/fork provider
      proc_exec: enosys,
      proc_exec3: enosys, // TODO(slice-7): proc/exec provider
      proc_join: enosys,
      proc_signal: enosys,
      // proc_signals_get / _sizes_get land with the signals provider in
      // Slice 8. Until then we report "zero registered signals" instead
      // of ENOSYS — wasix-libc's startup path treats ENOSYS as a fatal
      // init error and exits with 71 before reaching `main`, but a
      // size-0 signals table is the well-formed "no signals" answer
      // that lets early init complete.
      proc_signals_get: () => Result.SUCCESS,
      proc_signals_sizes_get: (sizePtr: number) => {
        new DataView(this.memory.buffer).setUint32(sizePtr, 0, true);
        return Result.SUCCESS;
      },
      proc_raise: enosys,
      proc_spawn: enosys,
      proc_spawn2: enosys, // TODO(slice-7): proc/spawn provider
      proc_spawn3: enosys, // TODO(slice-7): proc/spawn provider
      proc_exec4: enosys, // TODO(slice-7): proc/exec provider
      proc_id: enosys,
      proc_parent: enosys,

      // Random
      random_get: this.wasix_random_get.bind(this),

      // Scheduling
      sched_yield: enosys,

      // Sockets
      sock_accept: enosys,
      sock_addr_local: enosys,
      sock_addr_peer: enosys,
      sock_addr_resolve: enosys,
      sock_bind: enosys,
      sock_connect: enosys,
      sock_get_opt_flag: enosys,
      sock_get_opt_size: enosys,
      sock_get_opt_time: enosys,
      sock_listen: enosys,
      sock_open: enosys,
      sock_recv: enosys,
      sock_recv_from: enosys,
      sock_send: enosys,
      sock_send_file: enosys,
      sock_send_to: enosys,
      sock_set_opt_flag: enosys,
      sock_set_opt_size: enosys,
      sock_set_opt_time: enosys,
      sock_shutdown: enosys,
      sock_status: enosys,

      // Threads
      thread_exit: enosys,
      thread_id: enosys,
      thread_join: enosys,
      thread_parallelism: enosys,
      thread_signal: enosys,
      thread_sleep: enosys,
      thread_spawn: enosys,

      // Futex
      futex_wait: enosys,
      futex_wake: enosys,
      futex_wake_all: enosys,
      futex_wake_bitset: enosys,

      // Userspace context switching (wasix-libc green threads /
      // context-switching test). Needs stack reification — same class
      // of blocker as Asyncify; stubbed ENOSYS.
      context_create: enosys,
      context_destroy: enosys,
      context_switch: enosys,

      // Signals
      signal_register: enosys,
      proc_raise_interval: enosys,
      callback_signal: enosys,

      // TTY
      tty_get: enosys,
      tty_set: enosys,

      // Working directory
      getcwd: this.wasix_getcwd.bind(this),
      chdir: this.wasix_chdir.bind(this),

      // Poll
      poll_oneoff: enosys,

      // Bus / IPC (future)
      bus_open_local: enosys,
      bus_open: enosys,
      bus_close: enosys,
      bus_call: enosys,
      bus_subscribe: enosys,
      bus_poll: enosys,

      // Port / networking (future)
      port_bridge: enosys,
      port_unbridge: enosys,
      port_dhcp_acquire: enosys,
      port_addr_add: enosys,
      port_addr_remove: enosys,
      port_addr_clear: enosys,
      port_addr_list: enosys,
      port_mac: enosys,
      port_gateway_add: enosys,
      port_gateway_clear: enosys,
      port_gateway_list: enosys,
      port_route_add: enosys,
      port_route_remove: enosys,
      port_route_clear: enosys,
      port_route_list: enosys,

      // Thread locals
      thread_local_create: enosys,
      thread_local_destroy: enosys,
      thread_local_get: enosys,
      thread_local_set: enosys,

      // epoll
      epoll_create: enosys,
      epoll_ctl: enosys,
      epoll_wait: enosys,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readString(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
): string {
  // Copy out before decoding: when env.memory is a SharedArrayBuffer
  // (the threaded wasix-libc default) TextDecoder rejects views over it.
  // `slice` returns a Uint8Array backed by a fresh non-shared ArrayBuffer.
  return new TextDecoder().decode(
    new Uint8Array(memory.buffer, ptr, len).slice(),
  );
}

function readIOVectors(
  view: DataView,
  iovsPtr: number,
  iovsLen: number,
): Array<Uint8Array> {
  const result: Array<Uint8Array> = new Array(iovsLen);
  let ptr = iovsPtr;
  for (let i = 0; i < iovsLen; i++) {
    const bufferPtr = view.getUint32(ptr, true);
    ptr += 4;
    const bufferLen = view.getUint32(ptr, true);
    ptr += 4;
    result[i] = new Uint8Array(view.buffer, bufferPtr, bufferLen);
  }
  return result;
}

function mapError(
  e: unknown,
  debug: WASIXContext["debug"] | undefined,
  name: string,
): number {
  if (e instanceof WASIXError) return e.result;
  debug?.(name, [], Result.EIO, [{ error: String(e) }]);
  return Result.EIO;
}

function encodeFilestat(stat: {
  dev: bigint;
  ino: bigint;
  filetype: FileType;
  nlink: bigint;
  size: bigint;
  timestamps: { access: bigint; modification: bigint; change: bigint };
}): Uint8Array {
  const buffer = new Uint8Array(FILESTAT_SIZE);
  const view = new DataView(buffer.buffer);
  view.setBigUint64(0, stat.dev, true);
  view.setBigUint64(8, stat.ino, true);
  view.setUint8(16, stat.filetype);
  view.setBigUint64(24, stat.nlink, true);
  view.setBigUint64(32, stat.size, true);
  view.setBigUint64(40, stat.timestamps.access, true);
  view.setBigUint64(48, stat.timestamps.modification, true);
  view.setBigUint64(56, stat.timestamps.change, true);
  return buffer;
}

function encodeFdstat(stat: {
  filetype: FileType;
  fsFlags: number;
  fsRightsBase: bigint;
  fsRightsInheriting: bigint;
}): Uint8Array {
  const buffer = new Uint8Array(FDSTAT_SIZE);
  const view = new DataView(buffer.buffer);
  view.setUint8(0, stat.filetype);
  view.setUint16(2, stat.fsFlags, true);
  view.setBigUint64(8, stat.fsRightsBase, true);
  view.setBigUint64(16, stat.fsRightsInheriting, true);
  return buffer;
}

function encodeDirectoryEntries(
  entries: Array<{
    next: bigint;
    ino: bigint;
    filetype: FileType;
    name: string;
  }>,
): Uint8Array {
  const encoder = new TextEncoder();
  const encodedEntries = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const buffer = new Uint8Array(DIRENT_SIZE + nameBytes.byteLength);
    const view = new DataView(buffer.buffer);
    view.setBigUint64(0, entry.next, true);
    view.setBigUint64(8, entry.ino, true);
    view.setUint32(16, nameBytes.byteLength, true);
    view.setUint8(20, entry.filetype);
    buffer.set(nameBytes, DIRENT_SIZE);
    return buffer;
  });
  const totalLen = encodedEntries.reduce((acc, b) => acc + b.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const entry of encodedEntries) {
    out.set(entry, offset);
    offset += entry.byteLength;
  }
  return out;
}
