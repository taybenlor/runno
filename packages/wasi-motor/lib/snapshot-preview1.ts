// Adapted from https://github.com/cloudflare/workers-wasi/blob/main/src/snapshot_preview1.ts

// See: https://github.com/WebAssembly/WASI/blob/main/phases/snapshot/witx/wasi_snapshot_preview1.witx
// And: https://github.com/WebAssembly/WASI/blob/main/phases/snapshot/docs.md

export interface SnapshotPreview1 {
  args_get(argv_ptr: number, argv_buf_ptr: number): number;

  args_sizes_get(argc_ptr: number, argv_buf_size_ptr: number): number;

  clock_res_get(id: number, retptr0: number): number;

  clock_time_get(id: number, precision: bigint, retptr0: number): number;

  environ_get(env_ptr_ptr: number, env_buf_ptr: number): number;

  environ_sizes_get(env_ptr: number, env_buf_size_ptr: number): number;

  fd_advise(fd: number, offset: bigint, length: bigint, advice: number): number;

  fd_allocate(fd: number, offset: bigint, length: bigint): number;

  fd_close(fd: number): number;

  fd_datasync(fd: number): number;

  fd_fdstat_get(fd: number, retptr0: number): number;

  fd_fdstat_set_flags(fd: number, flags: number): number;

  fd_fdstat_set_rights(
    fd: number,
    fs_rights_base: bigint,
    fs_rights_inheriting: bigint
  ): number;

  fd_filestat_get(fd: number, retptr0: number): number;

  fd_filestat_set_size(fd: number, size: bigint): number;

  fd_filestat_set_times(
    fd: number,
    atim: bigint,
    mtim: bigint,
    fst_flags: number
  ): number;

  fd_pread(
    fd: number,
    iovs_ptr: number,
    iovs_len: number,
    offset: bigint,
    retptr0: number
  ): number;

  fd_prestat_dir_name(fd: number, path_ptr: number, path_len: number): number;

  fd_prestat_get(fd: number, retptr0: number): number;

  fd_pwrite(
    fd: number,
    ciovs_ptr: number,
    ciovs_len: number,
    offset: bigint,
    retptr0: number
  ): number;

  fd_read(
    fd: number,
    iovs_ptr: number,
    iovs_len: number,
    retptr0: number
  ): number;

  fd_readdir(
    fd: number,
    buf: number,
    buf_len: number,
    cookie: bigint,
    retptr0: number
  ): number;

  fd_renumber(old_fd: number, new_fd: number): number;

  fd_seek(fd: number, offset: bigint, whence: number, retptr0: number): number;

  fd_sync(fd: number): number;

  fd_tell(fd: number, retptr0: number): number;

  fd_write(
    fd: number,
    ciovs_ptr: number,
    ciovs_len: number,
    retptr0: number
  ): number;

  path_create_directory(fd: number, path_ptr: number, path_len: number): number;

  path_filestat_get(
    fd: number,
    flags: number,
    path_ptr: number,
    path_len: number,
    retptr0: number
  ): number;

  path_filestat_set_times(
    fd: number,
    flags: number,
    path_ptr: number,
    path_len: number,
    atim: bigint,
    mtime: bigint,
    fst_flags: number
  ): number;

  path_link(
    old_fd: number,
    old_flags: number,
    old_path_ptr: number,
    old_path_len: number,
    new_fd: number,
    new_path_ptr: number,
    new_path_len: number
  ): number;

  path_open(
    fd: number,
    dir_flags: number,
    path_ptr: number,
    path_len: number,
    oflags: number,
    rights_base: bigint,
    rights_inheriting: bigint,
    fdflags: number,
    retptr0: number
  ): number;

  path_readlink(
    fd: number,
    path_ptr: number,
    path_len: number,
    buf_ptr: number,
    buf_len: number,
    retptr0: number
  ): number;

  path_remove_directory(fd: number, path_ptr: number, path_len: number): number;

  path_rename(
    old_fd: number,
    old_path_ptr: number,
    old_path_len: number,
    new_fd: number,
    new_path_ptr: number,
    new_path_len: number
  ): number;

  path_symlink(
    old_path_ptr: number,
    old_path_len: number,
    fd: number,
    new_path_ptr: number,
    new_path_len: number
  ): number;

  path_unlink_file(fd: number, path_ptr: number, path_len: number): number;

  poll_oneoff(
    in_ptr: number,
    out_ptr: number,
    nsubscriptions: number,
    retptr0: number
  ): number;

  proc_exit(code: number): void;

  proc_raise(signal: number): number;

  random_get(buffer_ptr: number, buffer_len: number): number;

  sched_yield(): number;

  sock_accept(fd: number, flags: number): number;

  sock_recv(
    fd: number,
    ri_data_ptr: number,
    ri_data_len: number,
    ri_flags: number,
    retptr0: number,
    retptr1: number
  ): number;

  sock_send(
    fd: number,
    si_data_ptr: number,
    si_data_len: number,
    si_flags: number,
    retptr0: number
  ): number;

  sock_shutdown(fd: number, how: number): number;
}

export enum Result {
  SUCCESS = 0, // No error occurred. System call completed successfully.
  E2BIG = 1, // Argument list too long.
  EACCESS = 2, // Permission denied.
  EADDRINUSE = 3, // Address in use.
  EADDRNOTAVAIL = 4, // Address not available.
  EAFNOSUPPORT = 5, // Address family not supported.
  EAGAIN = 6, // Resource unavailable, or operation would block.
  EALREADY = 7, // Connection already in progress.
  EBADF = 8, // Bad file descriptor.
  EBADMSG = 9, // Bad message.
  EBUSY = 10, // Device or resource busy.
  ECANCELED = 11, // Operation canceled.
  ECHILD = 12, // No child processes.
  ECONNABORTED = 13, // Connection aborted.
  ECONNREFUSED = 14, // Connection refused.
  ECONNRESET = 15, // Connection reset.
  EDEADLK = 16, // Resource deadlock would occur.
  EDESTADDRREQ = 17, // Destination address required.
  EDOM = 18, // Mathematics argument out of domain of function.
  EDQUOT = 19, // Reserved
  EEXIST = 20, // File exists
  EFAULT = 21, // Bad address
  EFBIG = 22, // File too large
  EHOSTUNREACH = 23, // Host is unreachable
  EIDRM = 24, // Identifier removed
  EILSEQ = 25, // Illegal byte sequence
  EINPROGRESS = 26, // Operation in progress.
  EINTR = 27, // Interrupted function.
  EINVAL = 28, // Invalid argument.
  EIO = 29, // I/O Error.
  EISCONN = 30, // Socket is connected.
  EISDIR = 31, // Is a directory.
  ELOOP = 32, // Too many levels of symbolic links.
  EMFILE = 33, // File descriptor value too large.
  EMLINK = 34, // Too many links.
  EMSGSIZE = 35, // Message too large.
  EMULTIHOP = 36, // Reserved.
  ENAMETOOLONG = 37, // Filename too long.
  ENETDOWN = 38, // Network is down.
  ENETRESET = 39, // Connection aborted by network.
  ENETUNREACH = 40, // Network unreachable.
  ENFILE = 41, // Too many files open in system.
  ENOBUFS = 42, // No buffer space available.
  ENODEV = 43, // No such device.
  ENOENT = 44, // No such file or directory.
  ENOEXEC = 45, // Executable file format error.
  ENOLCK = 46, // No locks available.
  ENOLINK = 47, // Reserved.
  ENOMEM = 48, // Not enough space.
  ENOMSG = 49, // No message of the desired type.
  ENOPROTOOPT = 50, // Protocol not available.
  ENOSPC = 51, // No space left on device.
  ENOSYS = 52, // Function not supported.
  ENOTCONN = 53, // The socket is not connected.
  ENOTDIR = 54, // Not a directory or a symbolic link to a directory.
  ENOTEMPTY = 55, // Directory not empty.
  ENOTRECOVERABLE = 56, // State not recoverable.
  ENOTSOCK = 57, // Not a socket.
  ENOTSUP = 58, // Not supported, or operation not supported on socket.
  ENOTTY = 59, // Inappropriate I/O control operation.
  ENXIO = 60, // No such device or address.
  EOVERFLOW = 61, // Value too large to be stored in data type.
  EOWNERDEAD = 62, // Previous owner died.
  EPERM = 63, // Operation not permitted.
  EPIPE = 64, // Broken pipe.
  EPROTO = 65, // Protocol error.
  EPROTONOSUPPORT = 66, // Protocol not supported.
  EPROTOTYPE = 67, // Protocol wrong type for socket.
  ERANGE = 68, // Result too large.
  EROFS = 69, // Read-only file system.
  ESPIPE = 70, // Invalid seek.
  ESRCH = 71, // No such process.
  ESTALE = 72, // Reserved.
  ETIMEDOUT = 73, // Connection timed out.
  ETXTBSY = 74, // Text file busy.
  EXDEV = 75, // Cross device link.
  ENOTCAPABLE = 76, // Extension: Capabilities insufficient.
}

export enum Clock {
  REALTIME = 0,
  MONOTONIC = 1,
  PROCESS_CPUTIME_ID = 2,
  THREAD_CPUTIME_ID = 3,
}

export enum Whence {
  SET = 0, // Seek relative to start-of-file.
  CUR = 1, // Seek relative to current position.
  END = 2, // Seek relative to end-of-file.
}

export enum FileType {
  UNKNOWN = 0,
  BLOCK_DEVICE = 1,
  CHARACTER_DEVICE = 2,
  DIRECTORY = 3,
  REGULAR_FILE = 4,
  SOCKET_DGRAM = 5,
  SOCKET_STREAM = 6,
  SYMBOLIC_LINK = 7,
}

export enum PreopenType {
  DIR = 0,
}

export enum EventType {
  CLOCK = 0, // The time value of clock subscription_clock::id has reached timestamp subscription_clock::timeout.
  FD_READ = 1, // File descriptor subscription_fd_readwrite::file_descriptor has data available for reading. This event always triggers for regular files.
  FD_WRITE = 2, // File descriptor subscription_fd_readwrite::file_descriptor has capacity available for writing. This event always triggers for regular files.
}

export const LookupFlags = {
  SYMLINK_FOLLOW: 1 << 0, // As long as the resolved path corresponds to a symbolic
  // link, it is expanded.
};

export const OpenFlags = {
  CREAT: 1 << 0, // Create file if it does not exist.
  DIRECTORY: 1 << 1, // Fail if not a directory.
  EXCL: 1 << 2, // Fail if file already exists.
  TRUNC: 1 << 3, // Truncate file to size 0.
};

export const FileDescriptorFlags = {
  APPEND: 1 << 0, // Append mode: Data written to the file is always appended to the file's end.
  DSYNC: 1 << 1, // Write according to synchronized I/O data integrity completion. Only the data stored in the file is synchronized.
  NONBLOCK: 1 << 2, // Non-blocking mode.
  RSYNC: 1 << 3, // Synchronized read I/O operations.
  SYNC: 1 << 4, // Write according to synchronized I/O file integrity completion. In addition to synchronizing the data stored in the file, the implementation may also synchronously update the file's metadata.
};

export const RightsFlags = {
  FD_DATASYNC: BigInt(1) << BigInt(0),
  FD_READ: BigInt(1) << BigInt(1),
  FD_SEEK: BigInt(1) << BigInt(2),
  FD_FDSTAT_SET_FLAGS: BigInt(1) << BigInt(3),
  FD_SYNC: BigInt(1) << BigInt(4),
  FD_TELL: BigInt(1) << BigInt(5),
  FD_WRITE: BigInt(1) << BigInt(6),
  FD_ADVISE: BigInt(1) << BigInt(7),
  FD_ALLOCATE: BigInt(1) << BigInt(8),
  PATH_CREATE_DIRECTORY: BigInt(1) << BigInt(9),
  PATH_CREATE_FILE: BigInt(1) << BigInt(10),
  PATH_LINK_SOURCE: BigInt(1) << BigInt(11),
  PATH_LINK_TARGET: BigInt(1) << BigInt(12),
  PATH_OPEN: BigInt(1) << BigInt(13),
  FD_READDIR: BigInt(1) << BigInt(14),
  PATH_READLINK: BigInt(1) << BigInt(15),
  PATH_RENAME_SOURCE: BigInt(1) << BigInt(16),
  PATH_RENAME_TARGET: BigInt(1) << BigInt(17),
  PATH_FILESTAT_GET: BigInt(1) << BigInt(18),
  PATH_FILESTAT_SET_SIZE: BigInt(1) << BigInt(19),
  PATH_FILESTAT_SET_TIMES: BigInt(1) << BigInt(20),
  FD_FILESTAT_GET: BigInt(1) << BigInt(21),
  FD_FILESTAT_SET_SIZE: BigInt(1) << BigInt(22),
  FD_FILESTAT_SET_TIMES: BigInt(1) << BigInt(23),
  PATH_SYMLINK: BigInt(1) << BigInt(24),
  PATH_REMOVE_DIRECTORY: BigInt(1) << BigInt(25),
  PATH_UNLINK_FILE: BigInt(1) << BigInt(26),
  POLL_FD_READWRITE: BigInt(1) << BigInt(27),
  SOCK_SHUTDOWN: BigInt(1) << BigInt(28),
  SOCK_ACCEPT: BigInt(1) << BigInt(29),
};

export const FileStatTimestampFlags = {
  ATIM: 1 << 0, // Adjust the last data access timestamp to the value stored in filestat::atim.
  ATIM_NOW: 1 << 1, // Adjust the last data access timestamp to the time of clock clockid::realtime.
  MTIM: 1 << 2, // Adjust the last data modification timestamp to the value stored in filestat::mtim.
  MTIM_NOW: 1 << 3, // Adjust the last data modification timestamp to the time of clock clockid::realtime.
};

export const SubscriptionClockFlags = {
  SUBSCRIPTION_CLOCK_ABSTIME: 1 << 0, // If set, treat the timestamp provided in subscription_clock::timeout as an absolute timestamp of clock subscription_clock::id. If clear, treat the timestamp provided in subscription_clock::timeout relative to the current time value of clock subscription_clock::id.
};

export const EventReadWriteFlags = {
  FD_READWRITE_HANGUP: 1 << 0, // The peer of this socket has closed or disconnected.
};

export const FILESTAT_SIZE = 64;
export const SUBSCRIPTION_SIZE = 48;
export const EVENT_SIZE = 32;
