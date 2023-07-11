import {
  FileDescriptorFlags,
  FileType,
  OpenFlags,
  Result,
  Whence,
} from "./snapshot-preview1";
import { WASIFile, WASIFS, WASIPath, WASITimestamps } from "../types";

type FileDescriptor = number;

type DriveResult<T> = [Exclude<Result, Result.SUCCESS>] | [Result.SUCCESS, T];

type DirectoryEntry = { name: string; type: FileType };

export type DriveStat = {
  path: string;
  byteLength: number;
  timestamps: WASITimestamps;
  type: FileType;
};

export class WASIDrive {
  fs: WASIFS;
  nextFD: FileDescriptor = 10;
  openMap: Map<FileDescriptor, OpenFile | OpenDirectory> = new Map();

  constructor(fs: WASIFS) {
    this.fs = { ...fs };

    // Preopens are discovered by the binary using `fd_prestat_get` and then
    // mapping the integer space until you run out.
    // Convention is to start preopens at 3 (after STDIO).
    // See:
    //   1. how to access preopens - https://github.com/WebAssembly/WASI/issues/323
    //   2. how preopens work - https://github.com/WebAssembly/WASI/issues/352
    this.openMap.set(3, new OpenDirectory(this.fs, "/"));
  }

  //
  // Helpers
  //
  private openFile(
    fileData: WASIFile,
    truncateFile: boolean,
    fdflags: number
  ): DriveResult<FileDescriptor> {
    const file = new OpenFile(fileData, fdflags);
    if (truncateFile) {
      file.buffer = new Uint8Array(new ArrayBuffer(1024), 0, 0);
    }
    const fd = this.nextFD;
    this.openMap.set(fd, file);
    this.nextFD++;
    return [Result.SUCCESS, fd];
  }

  private openDir(fs: WASIFS, prefix: string): DriveResult<FileDescriptor> {
    const directory = new OpenDirectory(fs, prefix);
    const fd = this.nextFD;
    this.openMap.set(fd, directory);
    this.nextFD++;
    return [Result.SUCCESS, fd];
  }

  private hasDir(dir: OpenDirectory, path: string) {
    if (path === ".") {
      return true;
    }

    return dir.containsDirectory(path);
  }

  //
  // Public Interface
  //
  open(
    fdDir: FileDescriptor,
    path: WASIPath,
    oflags: number,
    fdflags: number
  ): DriveResult<FileDescriptor> {
    const createFileIfNone: boolean = !!(oflags & OpenFlags.CREAT);
    const failIfNotDir: boolean = !!(oflags & OpenFlags.DIRECTORY);
    const failIfFileExists: boolean = !!(oflags & OpenFlags.EXCL);
    const truncateFile: boolean = !!(oflags & OpenFlags.TRUNC);

    const openDir = this.openMap.get(fdDir);
    if (!(openDir instanceof OpenDirectory)) {
      // Must be relative to a directory
      return [Result.EBADF];
    }

    if (openDir.containsFile(path)) {
      // This is a file
      if (failIfNotDir) {
        return [Result.ENOTDIR];
      }
      if (failIfFileExists) {
        return [Result.EEXIST];
      }

      return this.openFile(openDir.get(path)!, truncateFile, fdflags);
    } else if (this.hasDir(openDir, path)) {
      if (path === ".") {
        return this.openDir(this.fs, "/");
      }

      const prefix = `/${path}/`;
      // This is a directory
      const dir = Object.entries(this.fs).filter(([s]) => s.startsWith(prefix));
      return this.openDir(Object.fromEntries(dir), prefix);
    } else {
      if (createFileIfNone) {
        const fullPath = openDir.fullPath(path);
        this.fs[fullPath] = {
          path: fullPath,
          mode: "binary",
          content: new Uint8Array(),
          timestamps: {
            access: new Date(),
            modification: new Date(),
            change: new Date(),
          },
        };
        return this.openFile(this.fs[fullPath], truncateFile, fdflags);
      }
      return [Result.ENOTCAPABLE];
    }
  }

  close(fd: FileDescriptor): Result {
    if (!this.openMap.has(fd)) {
      return Result.EBADF;
    }

    const file = this.openMap.get(fd);
    if (file instanceof OpenFile) {
      file.sync();
    }

    this.openMap.delete(fd);
    return Result.SUCCESS;
  }

  read(fd: FileDescriptor, bytes: number): DriveResult<Uint8Array> {
    const file = this.openMap.get(fd);
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.read(bytes)];
  }

  pread(
    fd: FileDescriptor,
    bytes: number,
    offset: number
  ): DriveResult<Uint8Array> {
    const file = this.openMap.get(fd);
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.pread(bytes, offset)];
  }

  write(fd: FileDescriptor, data: Uint8Array): Result {
    const file = this.openMap.get(fd);
    if (!file || file instanceof OpenDirectory) {
      return Result.EBADF;
    }

    file.write(data);
    return Result.SUCCESS;
  }

  pwrite(fd: FileDescriptor, data: Uint8Array, offset: number): Result {
    const file = this.openMap.get(fd);
    if (!file || file instanceof OpenDirectory) {
      return Result.EBADF;
    }

    file.pwrite(data, offset);
    return Result.SUCCESS;
  }

  sync(fd: FileDescriptor): Result {
    const file = this.openMap.get(fd);
    if (!file || file instanceof OpenDirectory) {
      return Result.EBADF;
    }

    file.sync();

    return Result.SUCCESS;
  }

  seek(
    fd: FileDescriptor,
    offset: bigint,
    whence: Whence
  ): DriveResult<bigint> {
    const file = this.openMap.get(fd);
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.seek(offset, whence)];
  }

  tell(fd: FileDescriptor): DriveResult<bigint> {
    const file = this.openMap.get(fd);
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.tell()];
  }

  renumber(oldFd: FileDescriptor, newFd: FileDescriptor): Result {
    if (!this.exists(oldFd) || !this.exists(newFd)) {
      return Result.EBADF;
    }

    if (oldFd === newFd) {
      return Result.SUCCESS;
    }

    this.close(newFd);
    this.openMap.set(newFd, this.openMap.get(oldFd)!);
    return Result.SUCCESS;
  }

  unlink(fdDir: FileDescriptor, path: string): Result {
    const openDir = this.openMap.get(fdDir);
    if (!(openDir instanceof OpenDirectory)) {
      // Must be relative to a directory
      return Result.EBADF;
    }

    if (!openDir.contains(path)) {
      return Result.ENOENT;
    }

    for (const key of Object.keys(this.fs)) {
      if (
        key === openDir.fullPath(path) ||
        key.startsWith(`${openDir.fullPath(path)}/`)
      ) {
        delete this.fs[key];
      }
    }

    return Result.SUCCESS;
  }

  rename(
    oldFdDir: FileDescriptor,
    oldPath: string,
    newFdDir: FileDescriptor,
    newPath: string
  ): Result {
    const oldDir = this.openMap.get(oldFdDir);
    const newDir = this.openMap.get(newFdDir);
    if (
      !(oldDir instanceof OpenDirectory) ||
      !(newDir instanceof OpenDirectory)
    ) {
      // Must be relative to a directory
      return Result.EBADF;
    }

    if (!oldDir.contains(oldPath)) {
      return Result.ENOENT;
    }

    if (newDir.contains(newPath)) {
      return Result.EEXIST;
    }

    const oldFullPath = oldDir.fullPath(oldPath);
    const newFullPath = newDir.fullPath(newPath);

    for (const key of Object.keys(this.fs)) {
      if (key.startsWith(oldFullPath)) {
        const newPath = key.replace(oldFullPath, newFullPath);
        this.fs[newPath] = this.fs[key];
        this.fs[newPath].path = newPath;
        delete this.fs[key];
      }
    }

    return Result.SUCCESS;
  }

  list(fd: FileDescriptor): DriveResult<Array<DirectoryEntry>> {
    const fdDir = this.openMap.get(fd);
    if (!(fdDir instanceof OpenDirectory)) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, fdDir.list()];
  }

  stat(fd: FileDescriptor): DriveResult<DriveStat> {
    const file = this.openMap.get(fd);
    if (!(file instanceof OpenFile)) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.stat()];
  }

  pathStat(fdDir: FileDescriptor, path: string): DriveResult<DriveStat> {
    const dir = this.openMap.get(fdDir);
    if (!(dir instanceof OpenDirectory)) {
      return [Result.EBADF];
    }

    if (dir.containsFile(path)) {
      const fullPath = dir.fullPath(path);
      const stat = new OpenFile(this.fs[fullPath], 0).stat();
      return [Result.SUCCESS, stat];
    } else if (this.hasDir(dir, path)) {
      if (path === ".") {
        return [Result.SUCCESS, new OpenDirectory(this.fs, "/").stat()];
      }

      const prefix = `/${path}/`;
      const dir = Object.entries(this.fs).filter(([s]) => s.startsWith(prefix));
      const stat = new OpenDirectory(Object.fromEntries(dir), prefix).stat();
      return [Result.SUCCESS, stat];
    } else {
      return [Result.ENOTCAPABLE];
    }
  }

  setFlags(fd: FileDescriptor, flags: number): Result {
    const file = this.openMap.get(fd);
    if (file instanceof OpenFile) {
      file.setFlags(flags);
      return Result.SUCCESS;
    } else {
      return Result.EBADF;
    }
  }

  setSize(fd: FileDescriptor, size: bigint): Result {
    const file = this.openMap.get(fd);
    if (file instanceof OpenFile) {
      file.setSize(Number(size));
      return Result.SUCCESS;
    } else {
      return Result.EBADF;
    }
  }

  setAccessTime(fd: FileDescriptor, date: Date): Result {
    const file = this.openMap.get(fd);
    if (file instanceof OpenFile) {
      file.setAccessTime(date);
      return Result.SUCCESS;
    } else {
      return Result.EBADF;
    }
  }

  setModificationTime(fd: FileDescriptor, date: Date): Result {
    const file = this.openMap.get(fd);
    if (file instanceof OpenFile) {
      file.setModificationTime(date);
      return Result.SUCCESS;
    } else {
      return Result.EBADF;
    }
  }

  pathSetAccessTime(fdDir: FileDescriptor, path: string, date: Date): Result {
    const dir = this.openMap.get(fdDir);
    if (!(dir instanceof OpenDirectory)) {
      return Result.EBADF;
    }

    const f = dir.get(path);
    if (!f) {
      return Result.ENOTCAPABLE;
    }
    const file = new OpenFile(f, 0);
    file.setAccessTime(date);
    file.sync();
    return Result.SUCCESS;
  }

  pathSetModificationTime(
    fdDir: FileDescriptor,
    path: string,
    date: Date
  ): Result {
    const dir = this.openMap.get(fdDir);
    if (!(dir instanceof OpenDirectory)) {
      return Result.EBADF;
    }

    const f = dir.get(path);
    if (!f) {
      return Result.ENOTCAPABLE;
    }
    const file = new OpenFile(f, 0);
    file.setModificationTime(date);
    file.sync();
    return Result.SUCCESS;
  }

  pathCreateDir(fdDir: FileDescriptor, path: string): Result {
    const dir = this.openMap.get(fdDir);
    if (!(dir instanceof OpenDirectory)) {
      return Result.EBADF;
    }

    if (dir.contains(path)) {
      return Result.ENOTCAPABLE;
    }

    // Since this FS doesn't really support directories,
    // just put a dummy file in the directory.
    // It'll be fine probably.
    const filePath = `${dir.fullPath(path)}/.runno`;
    this.fs[filePath] = {
      path: filePath,
      timestamps: {
        access: new Date(),
        modification: new Date(),
        change: new Date(),
      },
      mode: "string",
      content: "",
    };
    return Result.SUCCESS;
  }

  //
  // Public Helpers
  //

  exists(fd: FileDescriptor): boolean {
    return this.openMap.has(fd);
  }

  fileType(fd: FileDescriptor): FileType {
    const file = this.openMap.get(fd)!;
    if (!file) {
      return FileType.UNKNOWN;
    } else if (file instanceof OpenFile) {
      return FileType.REGULAR_FILE;
    } else {
      return FileType.DIRECTORY;
    }
  }

  fileFdflags(fd: FileDescriptor): number {
    const file = this.openMap.get(fd)!;
    if (file instanceof OpenFile) {
      return file.fdflags;
    } else {
      return 0;
    }
  }
}

class OpenFile {
  file: WASIFile;
  buffer: Uint8Array;
  private _offset: bigint = BigInt(0);
  isDirty: boolean = false;
  fdflags: number;
  flagAppend: boolean;
  flagDSync: boolean;
  flagNonBlock: boolean;
  flagRSync: boolean;
  flagSync: boolean;

  private get offset(): number {
    // Hack: This will cause overflow issues with offsets larger than 4gb
    //       but I hope that's fine??
    return Number(this._offset);
  }

  constructor(file: WASIFile, fdflags: number) {
    this.file = file;

    if (this.file.mode === "string") {
      const encoder = new TextEncoder();
      this.buffer = encoder.encode(this.file.content);
    } else {
      this.buffer = this.file.content;
    }

    this.fdflags = fdflags;
    this.flagAppend = !!(fdflags & FileDescriptorFlags.APPEND);
    this.flagDSync = !!(fdflags & FileDescriptorFlags.DSYNC);
    this.flagNonBlock = !!(fdflags & FileDescriptorFlags.NONBLOCK);
    this.flagRSync = !!(fdflags & FileDescriptorFlags.RSYNC);
    this.flagSync = !!(fdflags & FileDescriptorFlags.SYNC);
  }

  read(bytes: number) {
    const ret = this.buffer.subarray(this.offset, this.offset + bytes);
    this._offset += BigInt(ret.length);
    return ret;
  }

  pread(bytes: number, offset: number) {
    return this.buffer.subarray(offset, offset + bytes);
  }

  write(data: Uint8Array) {
    this.isDirty = true;

    if (this.flagAppend) {
      // TODO: Not sure what the semantics for offset are here
      const length = this.buffer.length;
      this.resize(length + data.byteLength);
      this.buffer.set(data, length);
    } else {
      const newSize = Math.max(
        this.offset + data.byteLength,
        this.buffer.byteLength
      );
      this.resize(newSize);
      this.buffer.set(data, this.offset);
      this._offset += BigInt(data.byteLength);
    }

    if (this.flagDSync || this.flagSync) {
      this.sync();
    }
  }

  pwrite(data: Uint8Array, offset: number) {
    this.isDirty = true;

    if (this.flagAppend) {
      // TODO: Not sure what the semantics for offset are here
      const length = this.buffer.length;
      this.resize(length + data.byteLength);
      this.buffer.set(data, length);
    } else {
      const newSize = Math.max(
        offset + data.byteLength,
        this.buffer.byteLength
      );
      this.resize(newSize);
      this.buffer.set(data, offset);
    }

    if (this.flagDSync || this.flagSync) {
      this.sync();
    }
  }

  sync() {
    if (!this.isDirty) {
      return;
    }

    this.isDirty = false;
    if (this.file.mode === "binary") {
      this.file.content = new Uint8Array(this.buffer);
      return;
    }

    const decoder = new TextDecoder();
    this.file.content = decoder.decode(this.buffer);
    return;
  }

  seek(offset: bigint, whence: Whence) {
    switch (whence) {
      case Whence.SET:
        this._offset = offset;
        break;
      case Whence.CUR:
        this._offset += offset;
        break;
      case Whence.END:
        this._offset = BigInt(this.buffer.length) + offset;
        break;
    }
    return this._offset;
  }

  tell() {
    return this._offset;
  }

  stat(): DriveStat {
    return {
      path: this.file.path,
      timestamps: this.file.timestamps,
      type: FileType.REGULAR_FILE,
      byteLength: this.buffer.length,
    };
  }

  setFlags(flags: number) {
    this.fdflags = flags;
  }

  setSize(size: number) {
    this.resize(size);
  }

  setAccessTime(date: Date) {
    this.file.timestamps.access = date;
  }

  setModificationTime(date: Date) {
    this.file.timestamps.modification = date;
  }

  /**
   * Resizes the buffer to be exactly requiredBytes length, while resizing the
   * underlying buffer to be larger if necessary.
   *
   * Resizing will internally double the buffer size to reduce the need for
   * resizing often.
   *
   * @param requiredBytes how many bytes the buffer needs to have available
   */
  private resize(requiredBytes: number) {
    if (requiredBytes <= this.buffer.buffer.byteLength) {
      this.buffer = new Uint8Array(this.buffer.buffer, 0, requiredBytes);
      return;
    }

    let underBuffer: ArrayBuffer;

    if (this.buffer.buffer.byteLength === 0) {
      underBuffer = new ArrayBuffer(requiredBytes < 1024 ? 1024 : requiredBytes * 2);
    } else if (requiredBytes > this.buffer.buffer.byteLength * 2) {
      underBuffer = new ArrayBuffer(requiredBytes * 2);
    } else {
      underBuffer = new ArrayBuffer(this.buffer.buffer.byteLength * 2);
    }

    const newBuffer = new Uint8Array(underBuffer, 0, requiredBytes);
    newBuffer.set(this.buffer);
    this.buffer = newBuffer;
  }
}

function removePrefix(path: string, prefix: string) {
  const escapedPrefix = prefix.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
  const leadingRegex = new RegExp(`^${escapedPrefix}`);
  return path.replace(leadingRegex, "");
}

class OpenDirectory {
  dir: WASIFS;
  prefix: string; // full folder path including /

  constructor(dir: WASIFS, prefix: string) {
    this.dir = dir;
    this.prefix = prefix;
  }

  containsFile(relativePath: string) {
    for (const path of Object.keys(this.dir)) {
      const name = removePrefix(path, this.prefix);
      if (name === relativePath) {
        return true;
      }
    }

    return false;
  }

  containsDirectory(relativePath: string) {
    for (const path of Object.keys(this.dir)) {
      const name = removePrefix(path, this.prefix);
      if (name.startsWith(`${relativePath}/`)) {
        return true;
      }
    }

    return false;
  }

  contains(relativePath: string) {
    for (const path of Object.keys(this.dir)) {
      const name = removePrefix(path, this.prefix);
      if (name === relativePath || name.startsWith(`${relativePath}/`)) {
        return true;
      }
    }

    return false;
  }

  get(relativePath: string): WASIFile | undefined {
    return this.dir[this.fullPath(relativePath)];
  }

  fullPath(relativePath: string) {
    return `${this.prefix}${relativePath}`;
  }

  list(): Array<DirectoryEntry> {
    const entries: Array<DirectoryEntry> = [];
    const seenFolders = new Set<string>();
    for (const path of Object.keys(this.dir)) {
      const name = removePrefix(path, this.prefix);
      if (name.includes("/")) {
        const dirName = name.split("/")[0];
        if (seenFolders.has(dirName)) {
          continue;
        }
        seenFolders.add(dirName);
        entries.push({ name: dirName, type: FileType.DIRECTORY });
      } else {
        entries.push({
          name,
          type: FileType.REGULAR_FILE,
        });
      }
    }

    return entries;
  }

  stat(): DriveStat {
    return {
      path: this.prefix,
      timestamps: {
        access: new Date(),
        modification: new Date(),
        change: new Date(),
      },
      type: FileType.DIRECTORY,
      byteLength: 0,
    };
  }
}
