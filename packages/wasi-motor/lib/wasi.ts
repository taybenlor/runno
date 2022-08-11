import { Result, Clock, SnapshotPreview1 } from "./snapshot-preview1";
import { WASIContext } from "./wasi-context";
import { WASIDrive } from "./wasi-drive";

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
      path_create_directory: this.path_create_directory.bind(this),
      path_filestat_get: this.path_filestat_get.bind(this),
      path_filestat_set_times: this.path_filestat_set_times.bind(this),
      path_link: this.path_link.bind(this),
      path_open: this.path_open.bind(this),
      path_readlink: this.path_readlink.bind(this),
      path_remove_directory: this.path_remove_directory.bind(this),
      path_rename: this.path_rename.bind(this),
      path_symlink: this.path_symlink.bind(this),
      path_unlink_file: this.path_unlink_file.bind(this),

      // Unimplemented
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

  // TODO: Investigate importing types from AssemblyScript
  //
  // https://github.com/AssemblyScript/assemblyscript/blob/main/std/assembly/bindings/wasi_snapshot_preview1.ts

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
        // TODO: Convert this to use performance.now
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
        view.setBigUint64(retptr0, BigInt(Date.now()) * BigInt(1e6), true);
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
        const dataOrResult = this.drive.read(fd, iov.byteLength);
        if (typeof dataOrResult === "number") {
          result = dataOrResult;
          break;
        } else {
          data = dataOrResult;
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
  fd_advise() {
    return Result.SUCCESS;
  }

  /**
   * Force the allocation of space in a file.
   * Note: This is similar to posix_fallocate in POSIX.
   */
  fd_allocate() {
    return Result.SUCCESS;
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
  fd_fdstat_get() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Adjust the flags associated with a file descriptor.
   * Note: This is similar to fcntl(fd, F_SETFL, flags) in POSIX.
   */
  fd_fdstat_set_flags() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Adjust the rights associated with a file descriptor. This can only be used
   * to remove rights, and returns errno::notcapable if called in a way that
   * would attempt to add rights
   */
  fd_fdstat_set_rights() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Return the attributes of an open file.
   */
  fd_filestat_get() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Adjust the size of an open file. If this increases the file's size, the
   * extra bytes are filled with zeros. Note: This is similar to ftruncate in
   * POSIX.
   */
  fd_filestat_set_size() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Adjust the timestamps of an open file or directory.
   * Note: This is similar to futimens in POSIX.
   */
  fd_filestat_set_times() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Read from a file descriptor, without using and updating the file
   * descriptor's offset. Note: This is similar to preadv in POSIX.
   */
  fd_pread() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Return a description of the given preopened file descriptor.
   */
  fd_prestat_dir_name() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Return a description of the given preopened file descriptor.
   */
  fd_prestat_get() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Write to a file descriptor, without using and updating the file
   * descriptor's offset. Note: This is similar to pwritev in POSIX.
   */
  fd_pwrite() {
    // TODO: Implement
    return Result.ENOSYS;
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
  fd_readdir() {
    // TODO: Implement
    return Result.ENOSYS;
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
  fd_renumber() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Move the offset of a file descriptor.
   * Note: This is similar to lseek in POSIX.
   */
  fd_seek(fd: number, offset: bigint, whence: number, retptr0: number) {
    const [result, newOffset] = this.drive.seek(fd, offset, whence);
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

    const view = new DataView(this.memory.buffer);
    view.setUint32(retptr0, offset, true);
    return result;
  }

  //
  // Paths
  //

  /**
   * Create a directory. Note: This is similar to mkdirat in POSIX.
   */
  path_create_directory() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Return the attributes of a file or directory.
   * Note: This is similar to stat in POSIX.
   */
  path_filestat_get() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Adjust the timestamps of a file or directory.
   * Note: This is similar to utimensat in POSIX.
   */
  path_filestat_set_times() {
    // TODO: Implement
    return Result.ENOSYS;
  }

  /**
   * Create a hard link. Note: This is similar to linkat in POSIX.
   */
  path_link() {
    return Result.ENOSYS;
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
    oflags: number, // TODO: This is important and changes opening behaviour
    rights_base: bigint,
    rights_inheriting: bigint,
    fdflags: number, // TODO: This is important and changes write behaviour
    retptr0: number
  ): number {
    const view = new DataView(this.memory.buffer);

    const pathBuffer = new Uint8Array(path_len);
    const memory = new Uint8Array(this.memory.buffer);
    pathBuffer.set(memory.subarray(path_ptr, path_len));

    const decoder = new TextDecoder();
    const path = decoder.decode(pathBuffer);

    const newFd = this.drive.open(fd, path);

    view.setUint32(retptr0, newFd, true);

    // TODO: Figure out how to do this my architecture isn't really shaped like this
    // geee how do you even start with this
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
   * Rename a file or directory. Note: This is similar to renameat in POSIX.
   */
  path_rename() {
    return Result.ENOSYS;
  }

  /**
   * Create a symbolic link. Note: This is similar to symlinkat in POSIX.
   */
  path_symlink() {
    return Result.ENOSYS;
  }

  /**
   * Unlink a file. Return errno::isdir if the path refers to a directory.
   * Note: This is similar to unlinkat(fd, path, 0) in POSIX.
   */
  path_unlink_file() {
    return Result.ENOSYS;
  }

  //
  // Unimplemented
  //

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

class WASIExit extends Error {
  code: number;
  constructor(code: number) {
    super();

    this.code = code;
  }
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
