import {
  FileDescriptorFlags,
  FileType,
  OpenFlags,
  Result,
  Whence,
} from "./snapshot-preview1";
import { WASIFile, WASIFS, WASIPath } from "./types";

type FileDescriptor = number;

type FSTree = {
  [name: string]: WASIFile | FSTree;
};

type DriveResult<T> = [Exclude<Result, Result.SUCCESS>] | [Result.SUCCESS, T];

function isWASIFile(
  maybeWASIFile: WASIFile | FSTree
): maybeWASIFile is WASIFile {
  return (
    "path" in maybeWASIFile &&
    "mode" in maybeWASIFile &&
    "content" in maybeWASIFile
  );
}

export class WASIDrive {
  fs: FSTree;
  nextFD: FileDescriptor = 10;
  openMap: Map<FileDescriptor, OpenFile | OpenDirectory> = new Map();

  constructor(fs: WASIFS) {
    this.fs = buildFSTree(fs);

    // Preopens are discovered by the binary using `fd_prestat_get` and then
    // mapping the integer space until you run out.
    // Convention is to start preopens at 3 (after STDIO).
    // See:
    //   1. how to access preopens - https://github.com/WebAssembly/WASI/issues/323
    //   2. how preopens work - https://github.com/WebAssembly/WASI/issues/352
    this.openMap.set(3, new OpenDirectory(this.fs));
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

  private openDir(tree: FSTree): DriveResult<FileDescriptor> {
    const directory = new OpenDirectory(tree);
    const fd = this.nextFD;
    this.openMap.set(fd, directory);
    this.nextFD++;
    return [Result.SUCCESS, fd];
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

    const tree = this.openMap.get(fdDir);
    if (!tree) {
      // TODO: Remove this log
      console.error("Open: Missing directory fd", fdDir);
      return [Result.EBADF];
    }

    if (tree instanceof OpenFile) {
      // TODO: Remove this log
      console.error("Open: fdDir was a file", tree);
      return [Result.EBADF];
    }

    const fileOrDir = findByPath(tree.tree, path);
    if (!fileOrDir) {
      if (createFileIfNone) {
        return this.openFile(
          {
            path: path,
            mode: "binary",
            content: new Uint8Array(),
          },
          truncateFile,
          fdflags
        );
      }
      return [Result.ENOENT];
    }

    if (failIfFileExists) {
      return [Result.EEXIST];
    }

    if (isWASIFile(fileOrDir)) {
      if (failIfNotDir) {
        return [Result.ENOTDIR];
      }
      return this.openFile(fileOrDir, truncateFile, fdflags);
    }

    return this.openDir(fileOrDir);
  }

  close(fd: FileDescriptor): Result {
    if (!this.openMap.has(fd)) {
      return Result.EBADF;
    }

    const file = this.openMap.get(fd)!;
    if (file instanceof OpenFile) {
      file.sync();
    }

    this.openMap.delete(fd);
    return Result.SUCCESS;
  }

  read(fd: FileDescriptor, bytes: number): DriveResult<Uint8Array> {
    const file = this.openMap.get(fd)!;
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
    const file = this.openMap.get(fd!);
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.pread(bytes, offset)];
  }

  write(fd: FileDescriptor, data: Uint8Array): Result {
    const file = this.openMap.get(fd)!;
    if (!file || file instanceof OpenDirectory) {
      return Result.EBADF;
    }

    file.write(data);
    return Result.SUCCESS;
  }

  pwrite(fd: FileDescriptor, data: Uint8Array, offset: number): Result {
    const file = this.openMap.get(fd)!;
    if (!file || file instanceof OpenDirectory) {
      return Result.EBADF;
    }

    file.pwrite(data, offset);
    return Result.SUCCESS;
  }

  sync(fd: FileDescriptor): Result {
    const file = this.openMap.get(fd)!;
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
    const file = this.openMap.get(fd)!;
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.seek(offset, whence)];
  }

  tell(fd: FileDescriptor): DriveResult<number> {
    const file = this.openMap.get(fd)!;
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF];
    }

    return [Result.SUCCESS, file.tell()];
  }

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

    console.log("creating file", file);

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
    console.log(
      "read buffer",
      this.offset,
      bytes,
      new TextDecoder().decode(new Uint8Array(ret)),
      "original file",
      new TextDecoder().decode(new Uint8Array(this.buffer))
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
}

class OpenDirectory {
  tree: FSTree;
  constructor(tree: FSTree) {
    this.tree = tree;
  }
}

function buildFSTree(fs: WASIFS) {
  const tree: FSTree = {};
  for (const [path, file] of Object.entries(fs)) {
    let nestedTree = tree;
    const nestings = path.split("/");
    while (nestings.length > 1) {
      const folder = nestings.shift()!;
      if (folder in nestedTree) {
        const nextNesting = nestedTree[folder];
        if (isWASIFile(nextNesting)) {
          throw new Error("FS tries to nest files inside files");
        }
        nestedTree = nextNesting;
      } else {
        nestedTree[folder] = {};
      }
    }
    if (nestings.length === 0) {
      throw new Error("File path invalid");
    }
    const name = nestings.shift()!;
    nestedTree[name] = file;
  }
  return tree;
}

function findByPath(tree: FSTree, path: WASIPath): FSTree | WASIFile | null {
  const nestings = path.split("/");
  while (nestings.length > 0) {
    const maybeFile = tree[nestings.shift()!];
    if (!maybeFile) {
      return null;
    }

    if (isWASIFile(maybeFile)) {
      return maybeFile;
    }
    tree = maybeFile;
  }
  return tree;
}
