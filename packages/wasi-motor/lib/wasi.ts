import {
  Result,
  Clock,
  SnapshotPreview1,
  RightsFlags,
  PreopenType,
  FileType,
  FileStatTimestampFlags,
  FILESTAT_SIZE,
} from "./snapshot-preview1";
import { WASIFS } from "./types";
import { WASIContext } from "./wasi-context";
import { DriveStat, WASIDrive } from "./wasi-drive";

type WASIExecutionResult = {
  exitCode: number;
  fs: WASIFS;
};

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
    this.drive = new WASIDrive(context.fs);
  }

  init(wasm: WebAssembly.WebAssemblyInstantiatedSource) {
    this.instance = wasm.instance;
    this.module = wasm.module;
    this.memory = this.instance.exports.memory as WebAssembly.Memory;

    this.initialized = true;
  }

  start(): WASIExecutionResult {
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
        return {
          exitCode: e.code,
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

  getImports(): WebAssembly.ModuleImports & SnapshotPreview1 {
    return {
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

      // Unimplemented
      path_create_directory: this.path_create_directory.bind(this),
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

  /**
   * Read command-line argument data. The size of the array should match that
   * returned by args_sizes_get. Each argument is expected to be \0 terminated.
   */
  args_get(argv_ptr_ptr: number, argv_buf_ptr: number): number {
    writeStringArrayToMemory(
      this.memory,
      this.context.args,
      argv_ptr_ptr,
      argv_buf_ptr
    );
    return Result.SUCCESS;
  }

  /**
   * Return command-line argument data sizes.
   */
  args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number {
    writeStringArraySizesToMemory(
      this.memory,
      this.context.args,
      argc_ptr,
      argv_buf_size_ptr
    );
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
    writeStringArrayToMemory(
      this.memory,
      this.envArray,
      env_ptr_ptr,
      env_buf_ptr
    );
    return Result.SUCCESS;
  }

  /**
   * Return environment variable data sizes.
   */
  environ_sizes_get(env_ptr: number, env_buf_size_ptr: number): number {
    writeStringArraySizesToMemory(
      this.memory,
      this.envArray,
      env_ptr,
      env_buf_size_ptr
    );
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
    crypto.getRandomValues(buffer);
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
    const iovs = createIOVectors(view, iovs_ptr, iovs_len);
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
    const iovs = createIOVectors(view, ciovs_ptr, ciovs_len);
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
        // We have to copy the `iov` to restrict text decoder to the bounds of
        // iov. Otherwise text decoder seems to just read all our memory.
        const output = decoder.decode(new Uint8Array(iov));
        stdfn(output);
      } else {
        result = this.drive.write(fd, new Uint8Array(iov));
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
    if (!this.drive.exists(fd)) {
      return Result.EBADF;
    }

    const type = this.drive.fileType(fd);
    const fdflags = this.drive.fileFdflags(fd);
    const rightsBase = ALL_RIGHTS;
    const rightsInheriting = ALL_RIGHTS;

    const view = new DataView(this.memory.buffer, retptr0, 24);
    view.setUint16(0, type, true);
    view.setUint32(2, fdflags, true);
    view.setBigUint64(8, rightsBase, true);
    view.setBigUint64(16, rightsInheriting, true);

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
    const [result, stat] = this.drive.stat(fd);
    if (result != Result.SUCCESS) {
      return result;
    }

    const data = createFilestat(stat);
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
    const iovs = createIOVectors(view, iovs_ptr, iovs_len);

    let bytesRead = 0;
    let result: Result = Result.SUCCESS;

    for (const iov of iovs) {
      let data: Uint8Array;

      const [error, value] = this.drive.pread(
        fd,
        iov.byteLength,
        Number(offset)
      );
      if (error !== Result.SUCCESS) {
        result = error;
        break;
      } else {
        data = value;
      }

      const bytes = Math.min(iov.byteLength, data.byteLength);
      iov.set(data.subarray(0, bytes));

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

    const dirname = new TextEncoder().encode(".");
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
    const iovs = createIOVectors(view, ciovs_ptr, ciovs_len);

    let bytesWritten = 0;

    let result = Result.SUCCESS;
    for (const iov of iovs) {
      if (iov.byteLength === 0) {
        continue;
      }

      result = this.drive.pwrite(fd, new Uint8Array(iov), Number(offset));
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
   * Note: This is similar to lseek in POSIX.
   */
  fd_seek(fd: number, offset: bigint, whence: number, retptr0: number) {
    const [result, newOffset] = this.drive.seek(fd, offset, whence);
    if (result !== Result.SUCCESS) {
      return result;
    }
    const view = new DataView(this.memory.buffer);
    view.setUint32(retptr0, newOffset, true);
    return result;
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
   */
  fd_tell(fd: number, retptr0: number): number {
    const [result, offset] = this.drive.tell(fd);
    if (result !== Result.SUCCESS) {
      return result;
    }

    const view = new DataView(this.memory.buffer);
    view.setUint32(retptr0, offset, true);
    return result;
  }

  //
  // Paths
  //

  /**
   * Return the attributes of a file or directory.
   * Note: This is similar to stat in POSIX.
   */
  path_filestat_get(
    fd: number,
    _: number,
    path_ptr: number,
    path_len: number,
    retptr0: number
  ): number {
    const path = new TextDecoder().decode(
      new Uint8Array(this.memory.buffer, path_ptr, path_len)
    );

    const [result, stat] = this.drive.pathStat(fd, path);
    if (result != Result.SUCCESS) {
      return result;
    }

    const statBuffer = createFilestat(stat);
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
   *                  is resolved.
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
    rights_base: bigint, // Runno just gives everything full rights
    rights_inheriting: bigint, // Runno just gives everything full rights
    fdflags: number,
    retptr0: number
  ): number {
    const view = new DataView(this.memory.buffer);
    const path = readString(this.memory, path_ptr, path_len);

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

    return this.drive.rename(old_fd_dir, oldPath, new_fd_dir, newPath);
  }

  /**
   * Unlink a file. Return errno::isdir if the path refers to a directory.
   * Note: This is similar to unlinkat(fd, path, 0) in POSIX.
   */
  path_unlink_file(fd: number, path_ptr: number, path_len: number): number {
    const path = readString(this.memory, path_ptr, path_len);
    return this.drive.unlink(fd, path);
  }

  //
  // Unimplemented - these operations are not supported by Runno
  //

  /**
   * Create a directory. Note: This is similar to mkdirat in POSIX.
   */
  path_create_directory() {
    return Result.ENOSYS;
  }

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
   * Concurrently poll for the occurrence of a set of events.
   */
  poll_oneoff(): number {
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
 * Writes an array of strings to memory, used for args and env.
 *
 * @param memory WebAssembly Memory
 * @param values The values to write
 * @param iter_ptr_ptr Pointer to an array of pointers that can be iterated through
 * @param buf_ptr The buffer to write to
 */
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

    // TODO: Do we need a null terminator on the string?
    const data = encoder.encode(`${value}\0`);
    buffer.set(data, buf_ptr);
    buf_ptr += data.length;
  }
}

/**
 * Writes the size of data needed to take an array of strings. Used for args and
 * env.
 *
 * @param memory Web Assembly memory
 * @param values The values to be written
 * @param count_ptr Pointer of where to store the number of values
 * @param buffer_size_ptr Pointer of where to store the size of buffer needed
 */
function writeStringArraySizesToMemory(
  memory: WebAssembly.Memory,
  values: Array<string>,
  count_ptr: number,
  buffer_size_ptr: number
): void {
  const view = new DataView(memory.buffer);
  const encoder = new TextEncoder();
  const len = values.reduce((acc, value) => {
    // TODO: Do we need a null terminator on the string?
    return acc + encoder.encode(`${value}\0`).length;
  }, 0);

  view.setUint32(count_ptr, values.length, true);
  view.setUint32(buffer_size_ptr, len, true);
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

/**
 * Creates a filestat record as bytes
 * File attributes.
 *  Size: 64
 *  Alignment: 8
 *  Record members
 *    dev (offset: 0, size: 8): device Device ID of device containing the file.
 *    ino (offset: 8, size: 8): inode File serial number.
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
  view.setBigUint64(24, BigInt(0), true); // nlink
  view.setBigUint64(32, BigInt(stat.byteLength), true); // size
  view.setBigUint64(40, BigInt(dateToNanoseconds(stat.timestamps.access))); // atim
  view.setBigUint64(
    48,
    BigInt(dateToNanoseconds(stat.timestamps.modification))
  ); // mtim
  view.setBigUint64(56, BigInt(dateToNanoseconds(stat.timestamps.change))); // ctim
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
