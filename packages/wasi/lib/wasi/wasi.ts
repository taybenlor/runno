import {
  Result,
  Clock,
  SnapshotPreview1,
  RightsFlags,
  PreopenType,
  FileType,
  FileStatTimestampFlags,
  FILESTAT_SIZE,
  SUBSCRIPTION_SIZE,
  EventType,
  SubscriptionClockFlags,
  EVENT_SIZE,
  OpenFlags,
  FileDescriptorFlags,
  Whence,
} from "./snapshot-preview1";
import { Whence as UnstableWhence } from "./unstable";
import { WASIExecutionResult } from "../types";
import { WASIContext, WASIContextOptions } from "./wasi-context";
import { DriveStat, WASIDrive } from "./wasi-drive";

/** Injects a function between implementation and return for debugging */
export type DebugFn = (
  name: string,
  args: string[],
  ret: number,
  data: { [key: string]: any }[]
) => number | undefined;

let _debugData: { [key: string]: string }[] = [];
function pushDebugData(data: { [key: string]: any }) {
  _debugData.push(data);
}

function popDebugStrings(): { [key: string]: string }[] {
  const current = _debugData;
  _debugData = [];
  return current;
}

/**
 * Implementation of a WASI runner for the browser.
 * Explicitly designed for the browser context, where system resources
 * must all be emulated. This WASI implementation relies on configuration and
 * callbacks to decide on what system resources are available and defaults
 * to providing none.
 *
 * This implementation adapted from cloudflare/workers-wasi
 * https://github.com/cloudflare/workers-wasi/blob/main/src/index.ts
 *
 */
export class WASI implements SnapshotPreview1 {
  instance!: WebAssembly.Instance;
  module!: WebAssembly.Module;
  memory!: WebAssembly.Memory;
  context: WASIContext;
  drive: WASIDrive;

  static async start(
    wasmSource: Response | PromiseLike<Response>,
    context: Partial<WASIContextOptions> = {}
  ) {
    const wasi = new WASI(context);
    const wasm = await WebAssembly.instantiateStreaming(
      wasmSource,
      wasi.getImportObject()
    );
    return wasi.start(wasm);
  }

  constructor(context: Partial<WASIContextOptions>) {
    this.context = new WASIContext(context);
    this.drive = new WASIDrive(this.context.fs);
  }

  getImportObject() {
    return {
      wasi_snapshot_preview1: this.getImports("preview1", this.context.debug),
      wasi_unstable: this.getImports("unstable", this.context.debug),
    };
  }

  start(
    wasm: WebAssembly.WebAssemblyInstantiatedSource,
    options: {
      memory?: WebAssembly.Memory;
    } = {}
  ): WASIExecutionResult {
    this.instance = wasm.instance;
    this.module = wasm.module;
    this.memory =
      options.memory ?? (this.instance.exports.memory as WebAssembly.Memory);

    const entrypoint = this.instance.exports._start as () => void;
    try {
      entrypoint();
    } catch (e) {
      if (e instanceof WASIExit) {
        return {
          exitCode: e.code,
          fs: this.drive.fs,
        };
      } else if (e instanceof WebAssembly.RuntimeError) {
        // Libc raises an unreachable error
        return {
          exitCode: 134,
          fs: this.drive.fs,
        };
      } else {
        throw e;
      }
    }

    // Nothing went wrong so this is a 0
    return {
      exitCode: 0,
      fs: this.drive.fs,
    };
  }

  getImports(
    version: "unstable" | "preview1",
    debug?: DebugFn
  ): WebAssembly.ModuleImports & SnapshotPreview1 {
    const imports = {
      args_get: this.args_get.bind(this),
      args_sizes_get: this.args_sizes_get.bind(this),
      clock_res_get: this.clock_res_get.bind(this),
      clock_time_get: this.clock_time_get.bind(this),
      environ_get: this.environ_get.bind(this),
      environ_sizes_get: this.environ_sizes_get.bind(this),
      proc_exit: this.proc_exit.bind(this),
      random_get: this.random_get.bind(this),
      sched_yield: this.sched_yield.bind(this),

      // File Descriptors
      fd_advise: this.fd_advise.bind(this),
      fd_allocate: this.fd_allocate.bind(this),
      fd_close: this.fd_close.bind(this),
      fd_datasync: this.fd_datasync.bind(this),
      fd_fdstat_get: this.fd_fdstat_get.bind(this),
      fd_fdstat_set_flags: this.fd_fdstat_set_flags.bind(this),
      fd_fdstat_set_rights: this.fd_fdstat_set_rights.bind(this),
      fd_filestat_get: this.fd_filestat_get.bind(this),
      fd_filestat_set_size: this.fd_filestat_set_size.bind(this),
      fd_filestat_set_times: this.fd_filestat_set_times.bind(this),
      fd_pread: this.fd_pread.bind(this),
      fd_prestat_dir_name: this.fd_prestat_dir_name.bind(this),
      fd_prestat_get: this.fd_prestat_get.bind(this),
      fd_pwrite: this.fd_pwrite.bind(this),
      fd_read: this.fd_read.bind(this),
      fd_readdir: this.fd_readdir.bind(this),
      fd_renumber: this.fd_renumber.bind(this),
      fd_seek: this.fd_seek.bind(this),
      fd_sync: this.fd_sync.bind(this),
      fd_tell: this.fd_tell.bind(this),
      fd_write: this.fd_write.bind(this),

      // Paths
      path_filestat_get: this.path_filestat_get.bind(this),
      path_filestat_set_times: this.path_filestat_set_times.bind(this),
      path_open: this.path_open.bind(this),
      path_rename: this.path_rename.bind(this),
      path_unlink_file: this.path_unlink_file.bind(this),
      path_create_directory: this.path_create_directory.bind(this),

      // Unimplemented
      path_link: this.path_link.bind(this),
      path_readlink: this.path_readlink.bind(this),
      path_remove_directory: this.path_remove_directory.bind(this),
      path_symlink: this.path_symlink.bind(this),
      poll_oneoff: this.poll_oneoff.bind(this),
      proc_raise: this.proc_raise.bind(this),
      sock_accept: this.sock_accept.bind(this),
      sock_recv: this.sock_recv.bind(this),
      sock_send: this.sock_send.bind(this),
      sock_shutdown: this.sock_shutdown.bind(this),

      // Unimplemented - WASMEdge compatibility
      sock_open: this.sock_open.bind(this),
      sock_listen: this.sock_listen.bind(this),
      sock_connect: this.sock_connect.bind(this),
      sock_setsockopt: this.sock_setsockopt.bind(this),
      sock_bind: this.sock_bind.bind(this),
      sock_getlocaladdr: this.sock_getlocaladdr.bind(this),
      sock_getpeeraddr: this.sock_getpeeraddr.bind(this),
      sock_getaddrinfo: this.sock_getaddrinfo.bind(this),
    };

    if (version === "unstable") {
      imports.path_filestat_get = this.unstable_path_filestat_get.bind(this);
      imports.fd_filestat_get = this.unstable_fd_filestat_get.bind(this);
      imports.fd_seek = this.unstable_fd_seek.bind(this);
    }

    for (const [name, fn] of Object.entries(imports)) {
      (imports as any)[name] = function () {
        let ret = (fn as any).apply(this, arguments);
        if (debug) {
          const argStrings = popDebugStrings();
          ret = debug(name, [...arguments], ret, argStrings) ?? ret;
        }
        return ret;
      };
    }
    return imports;
  }

  //
  // Helpers
  //

  get envArray(): Array<string> {
    return Object.entries(this.context.env).map(
      ([key, value]) => `${key}=${value}`
    );
  }

  //
  // WASI Implementation
  //

  /**
   * Read command-line argument data. The size of the array should match that
   * returned by args_sizes_get. Each argument is expected to be \0 terminated.
   */
  args_get(argv_ptr: number, argv_buf_ptr: number): number {
    const view = new DataView(this.memory.buffer);
    for (const argument of this.context.args) {
      view.setUint32(argv_ptr, argv_buf_ptr, true);
      argv_ptr += 4;

      const data = new TextEncoder().encode(`${argument}\0`);
      const buffer = new Uint8Array(
        this.memory.buffer,
        argv_buf_ptr,
        data.byteLength
      );
      buffer.set(data);
      argv_buf_ptr += data.byteLength;
    }
    return Result.SUCCESS;
  }

  /**
   * Return command-line argument data sizes.
   */
  args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number {
    const args = this.context.args;
    const totalByteLength = args.reduce((acc, value) => {
      return acc + new TextEncoder().encode(`${value}\0`).byteLength;
    }, 0);

    const view = new DataView(this.memory.buffer);
    view.setUint32(argc_ptr, args.length, true);
    view.setUint32(argv_buf_size_ptr, totalByteLength, true);

    return Result.SUCCESS;
  }

  /**
   * Return the resolution of a clock. Implementations are required to provide a
   * non-zero value for supported clocks. For unsupported clocks, return
   * errno::inval. Note: This is similar to clock_getres in POSIX.
   */
  clock_res_get(id: number, retptr0: number): number {
    switch (id) {
      case Clock.REALTIME:
      case Clock.MONOTONIC:
      case Clock.PROCESS_CPUTIME_ID:
      case Clock.THREAD_CPUTIME_ID: {
        const view = new DataView(this.memory.buffer);
        view.setBigUint64(retptr0, BigInt(1e6), true);
        return Result.SUCCESS;
      }
    }
    return Result.EINVAL;
  }

  /**
   * Return the time value of a clock.
   * Note: This is similar to clock_gettime in POSIX.
   */
  clock_time_get(id: number, _: bigint, retptr0: number): number {
    switch (id) {
      case Clock.REALTIME:
      case Clock.MONOTONIC:
      case Clock.PROCESS_CPUTIME_ID:
      case Clock.THREAD_CPUTIME_ID: {
        const view = new DataView(this.memory.buffer);
        view.setBigUint64(retptr0, dateToNanoseconds(new Date()), true);
        return Result.SUCCESS;
      }
    }
    return Result.EINVAL;
  }

  /**
   * Read environment variable data. The sizes of the buffers should match that
   * returned by environ_sizes_get. Key/value pairs are expected to be joined
   * with =s, and terminated with \0s.
   */
  environ_get(env_ptr_ptr: number, env_buf_ptr: number): number {
    const view = new DataView(this.memory.buffer);
    for (const value of this.envArray) {
      view.setUint32(env_ptr_ptr, env_buf_ptr, true);
      env_ptr_ptr += 4;

      const data = new TextEncoder().encode(`${value}\0`);
      const buffer = new Uint8Array(
        this.memory.buffer,
        env_buf_ptr,
        data.byteLength
      );
      buffer.set(data);
      env_buf_ptr += data.byteLength;
    }

    return Result.SUCCESS;
  }

  /**
   * Return environment variable data sizes.
   */
  environ_sizes_get(env_ptr: number, env_buf_size_ptr: number): number {
    const totalByteLength = this.envArray.reduce((acc, value) => {
      return acc + new TextEncoder().encode(`${value}\0`).byteLength;
    }, 0);

    const view = new DataView(this.memory.buffer);
    view.setUint32(env_ptr, this.envArray.length, true);
    view.setUint32(env_buf_size_ptr, totalByteLength, true);

    return Result.SUCCESS;
  }

  /**
   * Terminate the process normally. An exit code of 0 indicates successful
   * termination of the program. The meanings of other values is dependent on
   * the environment.
   */
  proc_exit(code: number): void {
    throw new WASIExit(code);
  }

  /**
   * Write high-quality random data into a buffer. This function blocks when the
   * implementation is unable to immediately provide sufficient high-quality
   * random data. This function may execute slowly, so when large mounts of
   * random data are required, it's advisable to use this function to seed a
   * pseudo-random number generator, rather than to provide the random data
   * directly.
   */
  random_get(buffer_ptr: number, buffer_len: number): number {
    const buffer = new Uint8Array(this.memory.buffer, buffer_ptr, buffer_len);
    globalThis.crypto.getRandomValues(buffer);
    return Result.SUCCESS;
  }

  /**
   * Temporarily yield execution of the calling thread.
   * Note: This is similar to sched_yield in POSIX.
   */
  sched_yield(): number {
    return Result.SUCCESS;
  }

  //
  // File Descriptors
  //

  /**
   * Read from a file descriptor. Note: This is similar to readv in POSIX.
   */
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

    const view = new DataView(this.memory.buffer);
    const iovs = readIOVectors(view, iovs_ptr, iovs_len);
    const encoder = new TextEncoder();

    let bytesRead = 0;
    let result: Result = Result.SUCCESS;

    for (const iov of iovs) {
      let data: Uint8Array;

      // Read from STDIN
      if (fd === 0) {
        // Using callbacks for a blocking call
        const input = this.context.stdin(iov.byteLength);
        if (!input) {
          break;
        }

        data = encoder.encode(input);
      } else {
        const [error, readData] = this.drive.read(fd, iov.byteLength);
        if (error) {
          result = error;
          break;
        } else {
          data = readData;
        }
      }

      const bytes = Math.min(iov.byteLength, data.byteLength);
      iov.set(data.subarray(0, bytes));

      bytesRead += bytes;
    }

    pushDebugData({ bytesRead });

    view.setUint32(retptr0, bytesRead, true);
    return result;
  }

  /**
   * Write to a file descriptor. Note: This is similar to writev in POSIX.
   */
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

    const view = new DataView(this.memory.buffer);
    const iovs = readIOVectors(view, ciovs_ptr, ciovs_len);
    const decoder = new TextDecoder();

    let bytesWritten = 0;

    let result = Result.SUCCESS;
    for (const iov of iovs) {
      if (iov.byteLength === 0) {
        continue;
      }

      // STDOUT or STDERR
      if (fd === 1 || fd === 2) {
        const stdfn = fd === 1 ? this.context.stdout : this.context.stderr;
        const output = decoder.decode(iov);
        stdfn(output);

        pushDebugData({ output });
      } else {
        result = this.drive.write(fd, iov);
        if (result != Result.SUCCESS) {
          break;
        }
      }

      bytesWritten += iov.byteLength;
    }

    view.setUint32(retptr0, bytesWritten, true);
    return result;
  }

  /**
   * Provide file advisory information on a file descriptor.
   * Note: This is similar to posix_fadvise in POSIX.
   */
  fd_advise(): number {
    // We don't care about how the program accesses our FS
    return Result.SUCCESS;
  }

  /**
   * Force the allocation of space in a file.
   * Note: This is similar to posix_fallocate in POSIX.
   */
  fd_allocate(fd: number, offset: bigint, length: bigint): number {
    return this.drive.pwrite(
      fd,
      new Uint8Array(Number(length)),
      Number(offset)
    );
  }

  /**
   * Close a file descriptor.
   * Note: This is similar to close in POSIX.
   *
   * @param fd
   */
  fd_close(fd: number) {
    return this.drive.close(fd);
  }

  /**
   * Synchronize the data of a file to disk.
   * Note: This is similar to fdatasync in POSIX.
   *
   * @param fd
   */
  fd_datasync(fd: number) {
    return this.drive.sync(fd);
  }

  /**
   * Get the attributes of a file descriptor.
   * Note: This returns similar flags to fsync(fd, F_GETFL) in POSIX,
   * as well as additional fields.
   *
   * Returns fdstat - the buffer where the file descriptor's attributes
   * are stored.
   *
   * @returns Result<fdstat, errno>
   */
  fd_fdstat_get(fd: number, retptr0: number): number {
    // STDIN / STDOUT / STDERR
    if (fd < 3) {
      let buffer: Uint8Array;
      if (this.context.isTTY) {
        // Turn off FD_SEEK and FD_TELL rights to communicate that it's a tty
        const rights = ALL_RIGHTS ^ RightsFlags.FD_SEEK ^ RightsFlags.FD_TELL;
        buffer = createFdStat(FileType.CHARACTER_DEVICE, 0, rights);
      } else {
        buffer = createFdStat(FileType.CHARACTER_DEVICE, 0);
      }
      const retBuffer = new Uint8Array(
        this.memory.buffer,
        retptr0,
        buffer.byteLength
      );
      retBuffer.set(buffer);

      return Result.SUCCESS;
    }

    if (!this.drive.exists(fd)) {
      return Result.EBADF;
    }

    const type = this.drive.fileType(fd);
    const fdflags = this.drive.fileFdflags(fd);
    const buffer = createFdStat(type, fdflags);
    const retBuffer = new Uint8Array(
      this.memory.buffer,
      retptr0,
      buffer.byteLength
    );
    retBuffer.set(buffer);

    return Result.SUCCESS;
  }

  /**
   * Adjust the flags associated with a file descriptor.
   * Note: This is similar to fcntl(fd, F_SETFL, flags) in POSIX.
   */
  fd_fdstat_set_flags(fd: number, flags: number): number {
    return this.drive.setFlags(fd, flags);
  }

  /**
   * Adjust the rights associated with a file descriptor. This can only be used
   * to remove rights, and returns errno::notcapable if called in a way that
   * would attempt to add rights
   */
  fd_fdstat_set_rights() {
    // Runno doesn't implement a rights system
    return Result.SUCCESS;
  }

  /**
   * Return the attributes of an open file.
   */
  fd_filestat_get(fd: number, retptr0: number): number {
    return this.shared_fd_filestat_get(fd, retptr0, "preview1");
  }

  /**
   * Return the attributes of an open file.
   * This version is used
   */
  unstable_fd_filestat_get(fd: number, retptr0: number): number {
    return this.shared_fd_filestat_get(fd, retptr0, "unstable");
  }

  /**
   * Return the attributes of an open file.
   */
  shared_fd_filestat_get(
    fd: number,
    retptr0: number,
    version: "unstable" | "preview1"
  ): number {
    const createFilestatFn =
      version === "unstable" ? createUnstableFilestat : createFilestat;

    // STDIN / STDOUT / STDERR
    if (fd < 3) {
      let path: string;
      switch (fd) {
        case 0:
          path = "/dev/stdin";
          break;
        case 1:
          path = "/dev/stdout";
          break;
        case 2:
          path = "/dev/stderr";
          break;
        default:
          path = "/dev/undefined";
          break;
      }
      const buffer = createFilestatFn({
        path,
        byteLength: 0,
        timestamps: {
          access: new Date(),
          modification: new Date(),
          change: new Date(),
        },
        type: FileType.CHARACTER_DEVICE,
      });
      const retBuffer = new Uint8Array(
        this.memory.buffer,
        retptr0,
        buffer.byteLength
      );
      retBuffer.set(buffer);

      return Result.SUCCESS;
    }

    const [result, stat] = this.drive.stat(fd);
    if (result != Result.SUCCESS) {
      return result;
    }

    pushDebugData({ resolvedPath: stat.path, stat });

    const data = createFilestatFn(stat);
    const returnBuffer = new Uint8Array(
      this.memory.buffer,
      retptr0,
      data.byteLength
    );
    returnBuffer.set(data);

    return Result.SUCCESS;
  }

  /**
   * Adjust the size of an open file. If this increases the file's size, the
   * extra bytes are filled with zeros. Note: This is similar to ftruncate in
   * POSIX.
   */
  fd_filestat_set_size(fd: number, size: bigint): number {
    return this.drive.setSize(fd, size);
  }

  /**
   * Adjust the timestamps of an open file or directory.
   * Note: This is similar to futimens in POSIX.
   */
  fd_filestat_set_times(
    fd: number,
    atim: bigint,
    mtim: bigint,
    fst_flags: number
  ): number {
    let accessTime: Date | null = null;
    if (fst_flags & FileStatTimestampFlags.ATIM) {
      accessTime = nanosecondsToDate(atim);
    }
    if (fst_flags & FileStatTimestampFlags.ATIM_NOW) {
      accessTime = new Date();
    }

    let modificationTime: Date | null = null;
    if (fst_flags & FileStatTimestampFlags.MTIM) {
      modificationTime = nanosecondsToDate(mtim);
    }
    if (fst_flags & FileStatTimestampFlags.MTIM_NOW) {
      modificationTime = new Date();
    }

    if (accessTime) {
      const result = this.drive.setAccessTime(fd, accessTime);
      if (result != Result.SUCCESS) {
        return result;
      }
    }

    if (modificationTime) {
      const result = this.drive.setModificationTime(fd, modificationTime);
      if (result != Result.SUCCESS) {
        return result;
      }
    }

    return Result.SUCCESS;
  }

  /**
   * Read from a file descriptor, without using and updating the file
   * descriptor's offset. Note: This is similar to preadv in POSIX.
   */
  fd_pread(
    fd: number,
    iovs_ptr: number,
    iovs_len: number,
    offset: bigint,
    retptr0: number
  ): number {
    // Read not supported on stdout and stderr
    if (fd === 1 || fd === 2) {
      return Result.ENOTSUP;
    }

    if (fd === 0) {
      return this.fd_read(fd, iovs_ptr, iovs_len, retptr0);
    }

    const view = new DataView(this.memory.buffer);
    const iovs = readIOVectors(view, iovs_ptr, iovs_len);

    let bytesRead = 0;
    let result: Result = Result.SUCCESS;

    for (const iov of iovs) {
      const [error, value] = this.drive.pread(
        fd,
        iov.byteLength,
        Number(offset) + bytesRead
      );
      if (error !== Result.SUCCESS) {
        result = error;
        break;
      }

      const bytes = Math.min(iov.byteLength, value.byteLength);
      iov.set(value.subarray(0, bytes));

      bytesRead += bytes;
    }

    view.setUint32(retptr0, bytesRead, true);
    return result;
  }

  /**
   * Return a description of the given preopened file descriptor.
   */
  fd_prestat_dir_name(fd: number, path_ptr: number, path_len: number): number {
    // Hardcode preopens
    if (fd !== 3) {
      return Result.EBADF;
    }

    const dirname = new TextEncoder().encode("/");
    const dirBuffer = new Uint8Array(this.memory.buffer, path_ptr, path_len);
    dirBuffer.set(dirname.subarray(0, path_len));

    return Result.SUCCESS;
  }

  /**
   * Return a description of the given preopened file descriptor.
   */
  fd_prestat_get(fd: number, retptr0: number): number {
    // Hardcode preopen to be fd 3
    if (fd !== 3) {
      return Result.EBADF;
    }

    const dirname = new TextEncoder().encode(".");

    const view = new DataView(this.memory.buffer, retptr0);
    view.setUint8(0, PreopenType.DIR);
    view.setUint32(4, dirname.byteLength, true);

    return Result.SUCCESS;
  }

  /**
   * Write to a file descriptor, without using and updating the file
   * descriptor's offset. Note: This is similar to pwritev in POSIX.
   */
  fd_pwrite(
    fd: number,
    ciovs_ptr: number,
    ciovs_len: number,
    offset: bigint,
    retptr0: number
  ): number {
    // Write not supported on STDIN
    if (fd === 0) {
      return Result.ENOTSUP;
    }

    if (fd === 1 || fd === 2) {
      return this.fd_write(fd, ciovs_ptr, ciovs_len, retptr0);
    }

    const view = new DataView(this.memory.buffer);
    const iovs = readIOVectors(view, ciovs_ptr, ciovs_len);

    let bytesWritten = 0;

    let result = Result.SUCCESS;
    for (const iov of iovs) {
      if (iov.byteLength === 0) {
        continue;
      }

      result = this.drive.pwrite(fd, iov, Number(offset));
      if (result != Result.SUCCESS) {
        break;
      }

      bytesWritten += iov.byteLength;
    }

    view.setUint32(retptr0, bytesWritten, true);
    return result;
  }

  /**
   * Read directory entries from a directory. When successful, the contents of
   * the output buffer consist of a sequence of directory entries. Each
   * directory entry consists of a dirent object, followed by dirent::d_namlen
   * bytes holding the name of the directory entry. This function fills the
   * output buffer as much as possible, potentially truncating the last
   * directory entry. This allows the caller to grow its read buffer size in
   * case it's too small to fit a single large directory entry, or skip the
   * oversized directory entry.
   */
  fd_readdir(
    fd: number,
    buf: number,
    buf_len: number,
    cookie: bigint,
    retptr0: number
  ): number {
    const [result, list] = this.drive.list(fd);
    if (result != Result.SUCCESS) {
      return result;
    }

    let entries: Array<Uint8Array> = [];
    let index = 0;
    for (const { name, type } of list) {
      const entry = createDirectoryEntry(name, type, index);
      entries.push(entry);
      index++;
    }
    entries = entries.slice(Number(cookie));

    const byteSize = entries.reduce((p, c) => p + c.byteLength, 0);

    const allEntries = new Uint8Array(byteSize);
    let offset = 0;
    for (const entry of entries) {
      allEntries.set(entry, offset);
      offset += entry.byteLength;
    }

    const buffer = new Uint8Array(this.memory.buffer, buf, buf_len);
    const bytesToWrite = allEntries.subarray(0, buf_len);
    buffer.set(bytesToWrite);

    const view = new DataView(this.memory.buffer);
    view.setUint32(retptr0, bytesToWrite.byteLength, true);

    return Result.SUCCESS;
  }

  /**
   * Atomically replace a file descriptor by renumbering another file
   * descriptor. Due to the strong focus on thread safety, this environment does
   * not provide a mechanism to duplicate or renumber a file descriptor to an
   * arbitrary number, like dup2(). This would be prone to race conditions, as
   * an actual file descriptor with the same number could be allocated by a
   * different thread at the same time. This function provides a way to
   * atomically renumber file descriptors, which would disappear if dup2() were
   * to be removed entirely.
   */
  fd_renumber(old_fd: number, new_fd: number): number {
    return this.drive.renumber(old_fd, new_fd);
  }

  /**
   * Move the offset of a file descriptor.
   *
   * The offset is specified as a bigint here
   * Note: This is similar to lseek in POSIX.
   *
   * The offset, and return type are FileSize (u64) which is represented by
   * bigint in JavaScript.
   */
  fd_seek(fd: number, offset: bigint, whence: number, retptr0: number) {
    const [result, newOffset] = this.drive.seek(fd, offset, whence);
    if (result !== Result.SUCCESS) {
      return result;
    }
    pushDebugData({ newOffset: newOffset.toString() });
    const view = new DataView(this.memory.buffer);
    view.setBigUint64(retptr0, newOffset, true);
    return result;
  }

  unstable_fd_seek(
    fd: number,
    offset: bigint,
    whence: number,
    retptr0: number
  ) {
    const newWhence = UNSTABLE_WHENCE_MAP[whence as UnstableWhence];
    return this.fd_seek(fd, offset, newWhence, retptr0);
  }

  /**
   * Synchronize the data and metadata of a file to disk.
   * Note: This is similar to fsync in POSIX.
   */
  fd_sync(fd: number) {
    return this.drive.sync(fd);
  }

  /**
   * Return the current offset of a file descriptor.
   * Note: This is similar to lseek(fd, 0, SEEK_CUR) in POSIX.
   *
   * The return type is FileSize (u64) which is represented by bigint in JS.
   *
   */
  fd_tell(fd: number, retptr0: number): number {
    const [result, offset] = this.drive.tell(fd);
    if (result !== Result.SUCCESS) {
      return result;
    }

    const view = new DataView(this.memory.buffer);
    view.setBigUint64(retptr0, offset, true);
    return result;
  }

  //
  // Paths
  //

  path_filestat_get(
    fd: number,
    flags: number,
    path_ptr: number,
    path_len: number,
    retptr0: number
  ): number {
    return this.shared_path_filestat_get(
      fd,
      flags,
      path_ptr,
      path_len,
      retptr0,
      "preview1"
    );
  }

  unstable_path_filestat_get(
    fd: number,
    flags: number,
    path_ptr: number,
    path_len: number,
    retptr0: number
  ): number {
    return this.shared_path_filestat_get(
      fd,
      flags,
      path_ptr,
      path_len,
      retptr0,
      "unstable"
    );
  }

  /**
   * Return the attributes of a file or directory.
   * Note: This is similar to stat in POSIX.
   */
  shared_path_filestat_get(
    fd: number,
    _: number,
    path_ptr: number,
    path_len: number,
    retptr0: number,
    version: "unstable" | "preview1"
  ): number {
    const createFilestatFn =
      version === "unstable" ? createUnstableFilestat : createFilestat;

    const path = new TextDecoder().decode(
      new Uint8Array(this.memory.buffer, path_ptr, path_len)
    );

    pushDebugData({ path });

    const [result, stat] = this.drive.pathStat(fd, path);
    if (result != Result.SUCCESS) {
      return result;
    }

    const statBuffer = createFilestatFn(stat);
    const returnBuffer = new Uint8Array(
      this.memory.buffer,
      retptr0,
      statBuffer.byteLength
    );
    returnBuffer.set(statBuffer);

    return result;
  }

  /**
   * Adjust the timestamps of a file or directory.
   * Note: This is similar to utimensat in POSIX.
   */
  path_filestat_set_times(
    fd: number,
    _: number, // Runno doesn't support links
    path_ptr: number,
    path_len: number,
    atim: bigint,
    mtim: bigint,
    fst_flags: number
  ): number {
    let accessTime: Date | null = null;
    if (fst_flags & FileStatTimestampFlags.ATIM) {
      accessTime = nanosecondsToDate(atim);
    }
    if (fst_flags & FileStatTimestampFlags.ATIM_NOW) {
      accessTime = new Date();
    }

    let modificationTime: Date | null = null;
    if (fst_flags & FileStatTimestampFlags.MTIM) {
      modificationTime = nanosecondsToDate(mtim);
    }
    if (fst_flags & FileStatTimestampFlags.MTIM_NOW) {
      modificationTime = new Date();
    }

    const path = new TextDecoder().decode(
      new Uint8Array(this.memory.buffer, path_ptr, path_len)
    );

    if (accessTime) {
      const result = this.drive.pathSetAccessTime(fd, path, accessTime);
      if (result != Result.SUCCESS) {
        return result;
      }
    }

    if (modificationTime) {
      const result = this.drive.pathSetModificationTime(
        fd,
        path,
        modificationTime
      );
      if (result != Result.SUCCESS) {
        return result;
      }
    }

    return Result.SUCCESS;
  }

  /**
   * Open a file or directory. The returned file descriptor is not guaranteed to
   * be the lowest-numbered file descriptor not currently open; it is randomized
   * to prevent applications from depending on making assumptions about indexes,
   * since this is error-prone in multi-threaded contexts. The returned file
   * descriptor is guaranteed to be less than 2**31.
   * Note: This is similar to openat in POSIX.
   * @param fd: fd
   * @param dirflags: lookupflags Flags determining the method of how the path
   *                  is resolved. Not supported by Runno (symlinks)
   * @param path: string The relative path of the file or directory to open,
   *              relative to the path_open::fd directory.
   * @param oflags: oflags The method by which to open the file.
   * @param fs_rights_base: rights The initial rights of the newly created file
   *                        descriptor. The implementation is allowed to return
   *                        a file descriptor with fewer rights than specified,
   *                        if and only if those rights do not apply to the type
   *                        of file being opened. The base rights are rights
   *                        that will apply to operations using the file
   *                        descriptor itself, while the inheriting rights are
   *                        rights that apply to file descriptors derived from
   *                        it.
   * @param fs_rights_inheriting: rights
   * @param fdflags: fdflags
   *
   */
  path_open(
    fd: number,
    _: number,
    path_ptr: number,
    path_len: number,
    oflags: number,
    // @ts-expect-error - unused, Runno just gives everything full rights
    rights_base: bigint,
    // @ts-expect-error - same as above
    rights_inheriting: bigint,
    fdflags: number,
    retptr0: number
  ): number {
    const view = new DataView(this.memory.buffer);
    const path = readString(this.memory, path_ptr, path_len);

    const createFileIfNone: boolean = !!(oflags & OpenFlags.CREAT);
    const failIfNotDir: boolean = !!(oflags & OpenFlags.DIRECTORY);
    const failIfFileExists: boolean = !!(oflags & OpenFlags.EXCL);
    const truncateFile: boolean = !!(oflags & OpenFlags.TRUNC);

    const flagAppend = !!(fdflags & FileDescriptorFlags.APPEND);
    const flagDSync = !!(fdflags & FileDescriptorFlags.DSYNC);
    const flagNonBlock = !!(fdflags & FileDescriptorFlags.NONBLOCK);
    const flagRSync = !!(fdflags & FileDescriptorFlags.RSYNC);
    const flagSync = !!(fdflags & FileDescriptorFlags.SYNC);
    pushDebugData({
      path,
      openFlags: {
        createFileIfNone,
        failIfNotDir,
        failIfFileExists,
        truncateFile,
      },
      fileDescriptorFlags: {
        flagAppend,
        flagDSync,
        flagNonBlock,
        flagRSync,
        flagSync,
      },
    });

    const [result, newFd] = this.drive.open(fd, path, oflags, fdflags);
    if (result) {
      // Error
      return result;
    }

    view.setUint32(retptr0, newFd, true);
    return result;
  }

  /**
   * Rename a file or directory. Note: This is similar to renameat in POSIX.
   */
  path_rename(
    old_fd_dir: number,
    old_path_ptr: number,
    old_path_len: number,
    new_fd_dir: number,
    new_path_ptr: number,
    new_path_len: number
  ): number {
    const oldPath = readString(this.memory, old_path_ptr, old_path_len);
    const newPath = readString(this.memory, new_path_ptr, new_path_len);

    pushDebugData({ oldPath, newPath });

    return this.drive.rename(old_fd_dir, oldPath, new_fd_dir, newPath);
  }

  /**
   * Unlink a file. Return errno::isdir if the path refers to a directory.
   * Note: This is similar to unlinkat(fd, path, 0) in POSIX.
   */
  path_unlink_file(fd: number, path_ptr: number, path_len: number): number {
    const path = readString(this.memory, path_ptr, path_len);
    pushDebugData({ path });

    return this.drive.unlink(fd, path);
  }

  /**
   * Concurrently poll for the occurrence of a set of events.
   */
  poll_oneoff(
    in_ptr: number,
    out_ptr: number,
    nsubscriptions: number,
    retptr0: number
  ): number {
    for (let i = 0; i < nsubscriptions; i++) {
      const subscriptionBuffer = new Uint8Array(
        this.memory.buffer,
        in_ptr + i * SUBSCRIPTION_SIZE,
        SUBSCRIPTION_SIZE
      );
      const subscription = readSubscription(subscriptionBuffer);

      const eventBuffer = new Uint8Array(
        this.memory.buffer,
        out_ptr + i * EVENT_SIZE,
        EVENT_SIZE
      );
      let byteLength = 0;
      let result: Result = Result.SUCCESS;
      switch (subscription.type) {
        case EventType.CLOCK:
          while (new Date() < subscription.timeout) {
            // Wait until we hit the event time
          }
          eventBuffer.set(
            createClockEvent(subscription.userdata, Result.SUCCESS)
          );
          break;
        case EventType.FD_READ:
          if (subscription.fd < 3) {
            // We can only read from STDIN
            if (subscription.fd === 0) {
              // TODO: Should this ping the Runno context to ask for stdin bytes?
              result = Result.SUCCESS;
              byteLength = 32;
            } else {
              result = Result.EBADF;
            }
          } else {
            const [r, stat] = this.drive.stat(subscription.fd);
            result = r;
            byteLength = stat ? stat.byteLength : 0;
          }

          eventBuffer.set(
            createFDReadWriteEvent(
              subscription.userdata,
              result,
              EventType.FD_READ,
              BigInt(byteLength)
            )
          );
          break;
        case EventType.FD_WRITE:
          byteLength = 0;
          result = Result.SUCCESS;
          if (subscription.fd < 3) {
            // We can't write to STDIN
            if (subscription.fd === 0) {
              result = Result.EBADF;
            } else {
              // assume STDOUT has capacity
              result = Result.SUCCESS;
              byteLength = 1024;
            }
          } else {
            const [r, stat] = this.drive.stat(subscription.fd);
            result = r;
            byteLength = stat ? stat.byteLength : 0;
          }

          eventBuffer.set(
            createFDReadWriteEvent(
              subscription.userdata,
              result,
              EventType.FD_READ,
              BigInt(byteLength)
            )
          );
          break;
      }
    }

    const returnView = new DataView(this.memory.buffer, retptr0, 4);
    returnView.setUint32(0, nsubscriptions, true);

    return Result.SUCCESS;
  }

  /**
   * Create a directory. Note: This is similar to mkdirat in POSIX.
   */
  path_create_directory(
    fd: number,
    path_ptr: number,
    path_len: number
  ): number {
    const path = readString(this.memory, path_ptr, path_len);
    return this.drive.pathCreateDir(fd, path);
  }

  //
  // Unimplemented - these operations are not supported by Runno
  //

  /**
   * Create a hard link. Note: This is similar to linkat in POSIX.
   */
  path_link() {
    return Result.ENOSYS;
  }

  /**
   * Read the contents of a symbolic link.
   * Note: This is similar to readlinkat in POSIX.
   */
  path_readlink() {
    return Result.ENOSYS;
  }

  /**
   * Remove a directory. Return errno::notempty if the directory is not empty.
   * Note: This is similar to unlinkat(fd, path, AT_REMOVEDIR) in POSIX.
   */
  path_remove_directory() {
    return Result.ENOSYS;
  }

  /**
   * Create a symbolic link. Note: This is similar to symlinkat in POSIX.
   */
  path_symlink() {
    return Result.ENOSYS;
  }

  /**
   * Send a signal to the process of the calling thread.
   * Note: This is similar to raise in POSIX.
   */
  proc_raise(): number {
    return Result.ENOSYS;
  }

  /**
   * Accept a new incoming connection. Note: This is similar to accept in POSIX.
   */
  sock_accept(): number {
    return Result.ENOSYS;
  }

  /**
   * Receive a message from a socket. Note: This is similar to recv in POSIX,
   * though it also supports reading the data into multiple buffers in the
   * manner of readv.
   */
  sock_recv(): number {
    return Result.ENOSYS;
  }

  /**
   * Send a message on a socket. Note: This is similar to send in POSIX, though
   * it also supports writing the data from multiple buffers in the manner of
   * writev.
   */
  sock_send(): number {
    return Result.ENOSYS;
  }

  /**
   * Shut down socket send and receive channels. Note: This is similar to
   * shutdown in POSIX.
   */
  sock_shutdown(): number {
    return Result.ENOSYS;
  }

  //
  // Unimplemented - these are for compatibility with Wasmedge
  //
  sock_open(): number {
    return Result.ENOSYS;
  }

  sock_listen(): number {
    return Result.ENOSYS;
  }

  sock_connect(): number {
    return Result.ENOSYS;
  }

  sock_setsockopt(): number {
    return Result.ENOSYS;
  }

  sock_bind(): number {
    return Result.ENOSYS;
  }

  sock_getlocaladdr(): number {
    return Result.ENOSYS;
  }

  sock_getpeeraddr(): number {
    return Result.ENOSYS;
  }

  sock_getaddrinfo(): number {
    return Result.ENOSYS;
  }
}

const ALL_RIGHTS: bigint =
  RightsFlags.FD_DATASYNC |
  RightsFlags.FD_READ |
  RightsFlags.FD_SEEK |
  RightsFlags.FD_FDSTAT_SET_FLAGS |
  RightsFlags.FD_SYNC |
  RightsFlags.FD_TELL |
  RightsFlags.FD_WRITE |
  RightsFlags.FD_ADVISE |
  RightsFlags.FD_ALLOCATE |
  RightsFlags.PATH_CREATE_DIRECTORY |
  RightsFlags.PATH_CREATE_FILE |
  RightsFlags.PATH_LINK_SOURCE |
  RightsFlags.PATH_LINK_TARGET |
  RightsFlags.PATH_OPEN |
  RightsFlags.FD_READDIR |
  RightsFlags.PATH_READLINK |
  RightsFlags.PATH_RENAME_SOURCE |
  RightsFlags.PATH_RENAME_TARGET |
  RightsFlags.PATH_FILESTAT_GET |
  RightsFlags.PATH_FILESTAT_SET_SIZE |
  RightsFlags.PATH_FILESTAT_SET_TIMES |
  RightsFlags.FD_FILESTAT_GET |
  RightsFlags.FD_FILESTAT_SET_SIZE |
  RightsFlags.FD_FILESTAT_SET_TIMES |
  RightsFlags.PATH_SYMLINK |
  RightsFlags.PATH_REMOVE_DIRECTORY |
  RightsFlags.PATH_UNLINK_FILE |
  RightsFlags.POLL_FD_READWRITE |
  RightsFlags.SOCK_SHUTDOWN |
  RightsFlags.SOCK_ACCEPT;

class WASIExit extends Error {
  code: number;
  constructor(code: number) {
    super();

    this.code = code;
  }
}

/**
 * Reads a string from WASM memory.
 *
 * @param memory WebAssembly Memory
 * @param ptr the offset in the memory where the string starts
 * @param len the length of the string
 * @returns the string at that address
 */
function readString(memory: WebAssembly.Memory, ptr: number, len: number) {
  return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len));
}

/**
 * Turns an IO Vectors pointer and length and converts these into Uint8Arrays
 * for convenient read/write.
 *
 * @param view
 * @param iovs_ptr
 * @param iovs_len
 * @returns
 */
function readIOVectors(
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

type Subscription = {
  userdata: Uint8Array;
} & (ClockSubscription | FDReadWriteSubscription);

type ClockSubscription = {
  type: EventType.CLOCK;
  id: number; // Clock ID
  timeout: Date;
  precision: Date;
};

type FDReadWriteSubscription = {
  type: EventType.FD_READ | EventType.FD_WRITE;
  fd: number;
};

/**
 * Subscription to an event.
 *
 * subscription: Record (size: 48, alignment: 8)
 * - userdata (offset: 0, size: 8) - User-provided value that is attached to the subscription in the implementation and returned through event::userdata
 * - subscription_u (offset: 8, size: 40) - The type of the event to which to subscribe, and its contents
 *
 * subscription_u: Variant (size: 40, alignment: 8, tag_size: 1)
 * - tag (offset: 0, size: 1) - Which EventType this subscription is
 * - data - subscription_clock | subscription_fd_readwrite
 *
 * subscription_clock: Record (size: 32, alignment: 8)
 * - id (offset: 0, size: 4) - The clock against which to compare the timestamp.
 * - timeout (offset: 8, size: 8) - The absolute or relative timestamp
 * - precision (offset: 16, size: 8) - The amount of time that the implementation may wait additionally to coalesce with other events.
 * - flags (offset: 24, size: 2) - Flags specifying whether the timeout is absolute or relative
 *
 * subscription_fd_readwrite: Record (size: 4, alignment: 4)
 * - fd (offset: 0, size: 4) - The file descriptor on which to wait for it to
 *                             become ready for reading or writing.
 *
 * @param buffer
 */
function readSubscription(buffer: Uint8Array): Subscription {
  const userdata = new Uint8Array(8);
  userdata.set(buffer.subarray(0, 8));

  const type: EventType = buffer[8];

  // View at SubscriptionU offset
  const view = new DataView(buffer.buffer, buffer.byteOffset + 9);
  switch (type) {
    case EventType.FD_READ:
    case EventType.FD_WRITE:
      return {
        userdata,
        type,
        fd: view.getUint32(0, true),
      };
    case EventType.CLOCK:
      const flags = view.getUint16(24, true);
      const currentTimeNanos = dateToNanoseconds(new Date());
      const timeoutRawNanos = view.getBigUint64(8, true);
      const precisionNanos = view.getBigUint64(16, true);

      const timeoutNanos =
        flags & SubscriptionClockFlags.SUBSCRIPTION_CLOCK_ABSTIME
          ? timeoutRawNanos
          : currentTimeNanos + timeoutRawNanos;

      return {
        userdata,
        type,
        id: view.getUint32(0, true),
        timeout: nanosecondsToDate(timeoutNanos),
        precision: nanosecondsToDate(timeoutNanos + precisionNanos),
      };
  }
}

/**
 * Creates a filestat record as bytes
 * File attributes.
 *  Size: 64
 *  Alignment: 8
 *  Record members
 *    dev (offset: 0, size: 8): device Device ID of device containing the file.
 *    ino (offset: 8, size: 8): inode File serial number that is unique within its file system.
 *    filetype (offset: 16, size: 1): filetype File type.
 *    nlink (offset: 24, size: 8): linkcount Number of hard links to the file.
 *    size (offset: 32, size: 8): filesize For regular files, the file size in bytes. For symbolic links, the length in bytes of the pathname contained in the symbolic link.
 *    atim (offset: 40, size: 8): timestamp Last data access timestamp.
 *    mtim (offset: 48, size: 8): timestamp Last data modification timestamp.
 *    ctim (offset: 56, size: 8): timestamp Last file status change timestamp.
 */
function createFilestat(stat: DriveStat): Uint8Array {
  const buffer = new Uint8Array(FILESTAT_SIZE);
  const view = new DataView(buffer.buffer);
  view.setBigUint64(0, BigInt(0), true); // dev
  view.setBigUint64(8, BigInt(cyrb53(stat.path)), true); // ino
  view.setUint8(16, stat.type); // filetype
  view.setBigUint64(24, BigInt(1), true); // nlink - every file has one hard link
  view.setBigUint64(32, BigInt(stat.byteLength), true); // size
  view.setBigUint64(40, dateToNanoseconds(stat.timestamps.access), true); // atim
  view.setBigUint64(48, dateToNanoseconds(stat.timestamps.modification), true); // mtim
  view.setBigUint64(56, dateToNanoseconds(stat.timestamps.change), true); // ctim
  return buffer;
}

/**
 * Creates a filestat record as bytes
 * This is the wasi-unstable (preview0) version
 * File attributes.
 *  Size: 64
 *  Alignment: 8
 *  Record members
 *    dev (offset: 0, size: 8): device Device ID of device containing the file.
 *    ino (offset: 8, size: 8): inode File serial number that is unique within its file system.
 *    filetype (offset: 16, size: 1): filetype File type.
 *    nlink (offset: 20, size: 4): linkcount Number of hard links to the file.
 *    size (offset: 24, size: 8): filesize For regular files, the file size in bytes. For symbolic links, the length in bytes of the pathname contained in the symbolic link.
 *    atim (offset: 32, size: 8): timestamp Last data access timestamp.
 *    mtim (offset: 40, size: 8): timestamp Last data modification timestamp.
 *    ctim (offset: 48, size: 8): timestamp Last file status change timestamp.
 *
 */
function createUnstableFilestat(stat: DriveStat): Uint8Array {
  const buffer = new Uint8Array(FILESTAT_SIZE);
  const view = new DataView(buffer.buffer);
  view.setBigUint64(0, BigInt(0), true); // dev
  view.setBigUint64(8, BigInt(cyrb53(stat.path)), true); // ino
  view.setUint8(16, stat.type); // filetype
  view.setUint32(20, 1, true); // nlink - every file has one hard link
  view.setBigUint64(24, BigInt(stat.byteLength), true); // size
  view.setBigUint64(32, dateToNanoseconds(stat.timestamps.access), true); // atim
  view.setBigUint64(40, dateToNanoseconds(stat.timestamps.modification), true); // mtim
  view.setBigUint64(48, dateToNanoseconds(stat.timestamps.change), true); // ctim
  return buffer;
}

/**
 * fdstat: Record (size: 24, alignment: 8)
 * File descriptor attributes.
 * Record members:
 * - fs_filetype (offset: 0, size: 1) filetype File type.
 * - fs_flags (offset: 2, size: 2): fdflags File descriptor flags.
 * - fs_rights_base (offset: 8, size: 8): rights Rights that apply to this file descriptor.
 * - fs_rights_inheriting (offset: 16, size: 8): rights Maximum set of rights that may be installed on new file descriptors that are created through this file descriptor, e.g., through path_open.
 */
function createFdStat(
  type: FileType,
  fdflags: number,
  rights?: bigint
): Uint8Array {
  const rightsBase = rights ?? ALL_RIGHTS;
  const rightsInheriting = rights ?? ALL_RIGHTS;

  const buffer = new Uint8Array(24);
  const view = new DataView(buffer.buffer, 0, 24);
  view.setUint8(0, type);
  view.setUint32(2, fdflags, true);
  view.setBigUint64(8, rightsBase, true);
  view.setBigUint64(16, rightsInheriting, true);
  return buffer;
}

/**
 * Creates a dirent (directory entry) Record as bytes
 * Size: 24
 * Alignment: 8
 * Record members
 * d_next (offset: 0, size: 8): <dircookie> The offset of the next directory entry stored
 *                     in this directory.
 * d_ino (offset: 8, size: 8): <inode> The serial number of the file referred to by this
 *                    directory entry.
 * d_namlen (offset: 16, size: 4): <dirnamlen> The length of the name of the directory
 *                        entry.
 * d_type (offset: 20, size: 1): <filetype> The type of the file referred to by this
 *                      directory entry.
 */
function createDirectoryEntry(
  name: string,
  type: FileType,
  currentIndex: number
): Uint8Array {
  // Each entry is made up of:
  // 0 - d_next = dircookie (size: 8) the offset of the next directory entry
  // 8 - d_ino = inode (size: 8) - the serial number of the file
  // 16 - d_namlen = dirnamlen (size: 4) - the length of the name of the entry
  // 20 - d_type = filetype (size: 1) - the type of the file returned by this entry
  // [24:24+d_namlen] = string (size: dnamlen) - the name of the directory

  const nameBytes = new TextEncoder().encode(name);
  const entryLength = 24 + nameBytes.byteLength;
  const buffer = new Uint8Array(entryLength);
  const view = new DataView(buffer.buffer);
  view.setBigUint64(0, BigInt(currentIndex + 1), true);
  view.setBigUint64(8, BigInt(cyrb53(name)), true);
  view.setUint32(16, nameBytes.length, true);
  view.setUint8(20, type);
  buffer.set(nameBytes, 24);
  return buffer;
}

/**
 * event: Record (size: 32, alignment: 8)
 *
 * - userdata: userdata (offset: 0, size: 8) - User-provided value that got attached to subscription::userdata
 * - error: errno (offset: 8, size: 2) - If non-zero, an error that occurred while processing the subscription request
 * - eventtype: eventtype (offset: 10, size: 2) - The type of event that occured
 * - fd_readwrite: event_fd_readwrite  (offset: 16, size: 16) - The contents of an event when type is eventtype::fd_read or eventtype::fd_write
 *
 */
function createClockEvent(userdata: Uint8Array, error: Result): Uint8Array {
  const eventBuffer = new Uint8Array(32);
  eventBuffer.set(userdata, 0);

  const view = new DataView(eventBuffer.buffer);
  view.setUint16(8, error, true);
  view.setUint16(10, EventType.CLOCK, true);

  return eventBuffer;
}

/**
 * event: Record (size: 32, alignment: 8)
 *
 * - userdata: userdata (offset: 0, size: 8) - User-provided value that got attached to subscription::userdata
 * - error: errno (offset: 8, size: 2) - If non-zero, an error that occurred while processing the subscription request
 * - eventtype: eventtype (offset: 10, size: 2) - The type of event that occured
 * - fd_readwrite: event_fd_readwrite  (offset: 16, size: 16) - The contents of an event when type is eventtype::fd_read or eventtype::fd_write
 *
 * event_fd_readwrite: Record (size: 16, alignment: 8)
 * - nbytes: filesize (offset: 0, size: 8) - The number of bytes available for reading or writing.
 * - flags: eventrwflags (offset: 8, ) - The state of the file descriptor.
 */
function createFDReadWriteEvent(
  userdata: Uint8Array,
  error: Result,
  type: EventType.FD_READ | EventType.FD_WRITE,
  nbytes: bigint
): Uint8Array {
  const eventBuffer = new Uint8Array(32);
  eventBuffer.set(userdata, 0);

  const view = new DataView(eventBuffer.buffer);
  view.setUint16(8, error, true);
  view.setUint16(10, type, true);

  view.setBigUint64(16, nbytes, true);

  return eventBuffer;
}

/**
 * Hash function from stack overflow lol
 * https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
 * @param str
 * @param seed
 * @returns
 */
function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function dateToNanoseconds(date: Date) {
  return BigInt(date.getTime()) * BigInt(1e6);
}

function nanosecondsToDate(nanos: bigint) {
  return new Date(Number(nanos / BigInt(1e6)));
}

// Whence in wasi_unstable and wasi_snapshot_preview1 has different values
const UNSTABLE_WHENCE_MAP = {
  [UnstableWhence.CUR]: Whence.CUR,
  [UnstableWhence.END]: Whence.END,
  [UnstableWhence.SET]: Whence.SET,
};
