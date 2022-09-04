import {
  FileDescriptorFlags,
  FileType,
  OpenFlags,
  Result,
  Whence,
} from "./snapshot-preview1";
import { WASIFile, WASIFS, WASIPath, WASITimestamps } from "./types";

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
    this.openMap.set(3, new OpenDirectory(this.fs, ""));
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
      file.buffer = new Uint8Array();
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

  private hasDir(path: string) {
    if (path === ".") {
      return true;
    }

    return !!Object.keys(this.fs).find((s) => s.startsWith(`${path}/`));
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

    if (path in this.fs) {
      // This is a file
      if (failIfNotDir) {
        return [Result.ENOTDIR];
      }
      if (failIfFileExists) {
        return [Result.EEXIST];
      }
      return this.openFile(this.fs[path], truncateFile, fdflags);
    } else if (this.hasDir(path)) {
      if (path === ".") {
        return this.openDir(this.fs, "");
      }

      const prefix = `${path}/`;
      // This is a directory
      const dir = Object.entries(this.fs).filter(([s]) => s.startsWith(prefix));
      return this.openDir(Object.fromEntries(dir), prefix);
    } else {
      if (createFileIfNone) {
        this.fs[path] = {
          path: path,
          mode: "binary",
          content: new Uint8Array(),
          timestamps: {
            access: new Date(),
            modification: new Date(),
            change: new Date(),
          },
        };
        return this.openFile(this.fs[path], truncateFile, fdflags);
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
  ): DriveResult<number> {
    const file = this.openMap.get(fd);
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.seek(offset, whence)];
  }

  tell(fd: FileDescriptor): DriveResult<number> {
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

    for (const key of Object.keys(this.fs)) {
      const oldFullPath = oldDir.fullPath(oldPath);
      const newFullPath = newDir.fullPath(newPath);
      if (key.startsWith(oldFullPath)) {
        const newPath = key.replace(oldFullPath, newFullPath);
        this.fs[newPath] = this.fs[key];
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

    if (path in this.fs) {
      return [Result.SUCCESS, new OpenFile(this.fs[path], 0).stat()];
    } else if (Object.keys(this.fs).find((s) => s.startsWith(`${path}/`))) {
      const prefix = `${path}/`;
      // This is a directory
      const dir = Object.entries(this.fs).filter(([s]) => s.startsWith(prefix));
      return [
        Result.SUCCESS,
        new OpenDirectory(Object.fromEntries(dir), prefix).stat(),
      ];
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
  private offset: number = 0;
  isDirty: boolean = false;
  fdflags: number;
  flagAppend: boolean;
  flagDSync: boolean;
  flagNonBlock: boolean;
  flagRSync: boolean;
  flagSync: boolean;

  constructor(file: WASIFile, fdflags: number) {
    this.file = file;

    if (this.file.mode === "string") {
      const encoder = new TextEncoder();
      this.buffer = encoder.encode(this.file.content);
    } else {
      this.buffer = new Uint8Array(this.file.content);
    }

    this.fdflags = fdflags;
    this.flagAppend = !!(fdflags & FileDescriptorFlags.APPEND);
    this.flagDSync = !!(fdflags & FileDescriptorFlags.DSYNC);
    this.flagNonBlock = !!(fdflags & FileDescriptorFlags.NONBLOCK);
    this.flagRSync = !!(fdflags & FileDescriptorFlags.RSYNC);
    this.flagSync = !!(fdflags & FileDescriptorFlags.SYNC);
  }

  read(bytes: number) {
    const ret = new Uint8Array(
      this.buffer.subarray(this.offset, this.offset + bytes)
    );
    this.offset += bytes;
    return ret;
  }

  pread(bytes: number, offset: number) {
    const ret = new Uint8Array(this.buffer.subarray(offset, bytes));
    return ret;
  }

  write(data: Uint8Array) {
    this.isDirty = true;

    if (this.flagAppend) {
      // TODO: Not sure what the semantics for offset are here
      const newBuffer = new Uint8Array(
        this.buffer.byteLength + data.byteLength
      );
      newBuffer.set(this.buffer);
      newBuffer.set(data, this.buffer.byteLength);
      this.buffer = newBuffer;
    } else if (this.offset + data.byteLength > this.buffer.byteLength) {
      const newBuffer = new Uint8Array(this.offset + data.byteLength);
      newBuffer.set(this.buffer);
      newBuffer.set(data, this.offset);
      this.buffer = newBuffer;
      this.offset += data.byteLength;
    } else {
      this.buffer.set(data, this.offset);
      this.offset += data.byteLength;
    }

    if (this.flagDSync || this.flagSync) {
      this.sync();
    }
  }

  pwrite(data: Uint8Array, offset: number) {
    this.isDirty = true;

    if (this.flagAppend) {
      // TODO: Not sure what the semantics for offset are here?
      const newBuffer = new Uint8Array(
        this.buffer.byteLength + data.byteLength + offset
      );
      newBuffer.set(this.buffer);
      newBuffer.set(data, this.buffer.byteLength + offset);
      this.buffer = newBuffer;
    } else if (offset + data.byteLength > this.buffer.byteLength) {
      const newBuffer = new Uint8Array(offset + data.byteLength);
      newBuffer.set(this.buffer);
      newBuffer.set(data, offset);
      this.buffer = newBuffer;
    } else {
      this.buffer.set(data);
    }

    if (this.flagDSync || this.flagSync) {
      this.sync();
    }
  }

  sync() {
    if (!this.isDirty) {
      return;
    }

    if (this.file.mode === "binary") {
      this.file.content = this.buffer;
      return;
    }

    const decoder = new TextDecoder();
    this.file.content = decoder.decode(this.buffer);
    this.isDirty = false;
    return;
  }

  seek(offset: bigint, whence: Whence) {
    // TODO: Technically we're losing precision here by casting
    //       bigint to number, that will cause issues with big files
    switch (whence) {
      case Whence.SET:
        this.offset = Number(offset);
        break;
      case Whence.CUR:
        this.offset += Number(offset);
        break;
      case Whence.END:
        this.offset = this.buffer.byteLength + Number(offset);
        break;
    }
    return this.offset;
  }

  tell() {
    return this.offset;
  }

  stat(): DriveStat {
    return {
      path: this.file.path,
      timestamps: this.file.timestamps,
      type: FileType.REGULAR_FILE,
      byteLength: this.buffer.byteLength,
    };
  }

  setFlags(flags: number) {
    this.fdflags = flags;
  }

  setSize(size: number) {
    const newBuffer = new Uint8Array(size);
    newBuffer.set(this.buffer.subarray(0, size));
    this.buffer = newBuffer;
  }

  setAccessTime(date: Date) {
    this.file.timestamps.access = date;
  }

  setModificationTime(date: Date) {
    this.file.timestamps.modification = date;
  }
}

class OpenDirectory {
  dir: WASIFS;
  prefix: string; // full folder path including /

  constructor(dir: WASIFS, prefix: string) {
    this.dir = dir;
    this.prefix = prefix;
  }

  contains(relativePath: string) {
    for (const path of Object.keys(this.dir)) {
      const name = path.replace(this.prefix, "");
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
      const name = path.replace(this.prefix, "");
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
