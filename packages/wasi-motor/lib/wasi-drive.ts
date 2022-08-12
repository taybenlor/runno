import { OpenFlags, Result, Whence } from "./snapshot-preview1";
import { WASIFile, WASIFS, WASIPath } from "./types";

type FileDescriptor = number;

type FSTree = {
  [name: string]: WASIFile | FSTree;
};

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
  private openFile(fileData: WASIFile, truncateFile: boolean): Result {
    const file = new OpenFile(fileData);
    if (truncateFile) {
      file.buffer = new Uint8Array();
    }
    this.openMap.set(this.nextFD, file);
    this.nextFD++;
    return Result.SUCCESS;
  }

  private openDir(tree: FSTree): Result {
    const directory = new OpenDirectory(tree);
    this.openMap.set(this.nextFD, directory);
    this.nextFD++;
    return Result.SUCCESS;
  }

  //
  // Public Interface
  //
  open(
    fdDir: FileDescriptor,
    path: WASIPath,
    oflags: number,
    _: number
  ): Result {
    const createFileIfNone: boolean = !!(oflags & OpenFlags.CREAT);
    const failIfNotDir: boolean = !!(oflags & OpenFlags.DIRECTORY);
    const failIfFileExists: boolean = !!(oflags & OpenFlags.EXCL);
    const truncateFile: boolean = !!(oflags & OpenFlags.TRUNC);

    const tree = this.openMap.get(fdDir);
    if (!tree) {
      // TODO: Remove this log
      console.error("Open: Missing directory fd", fdDir);
      return Result.EBADF;
    }

    if (tree instanceof OpenFile) {
      // TODO: Remove this log
      console.error("Open: fdDir was a file", tree);
      return Result.EBADF;
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
          truncateFile
        );
      }
      return Result.ENOENT;
    }

    if (failIfFileExists) {
      return Result.EEXIST;
    }

    if (isWASIFile(fileOrDir)) {
      if (failIfNotDir) {
        return Result.ENOTDIR;
      }
      return this.openFile(fileOrDir, truncateFile);
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

  read(fd: FileDescriptor, bytes: number): Result | Uint8Array {
    const file = this.openMap.get(fd)!;
    if (!file || file instanceof OpenDirectory) {
      return Result.EBADF;
    }

    return file.read(bytes);
  }

  write(fd: FileDescriptor, data: Uint8Array): Result {
    const file = this.openMap.get(fd)!;
    if (!file || file instanceof OpenDirectory) {
      return Result.EBADF;
    }

    file.write(data);
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

  seek(fd: FileDescriptor, offset: bigint, whence: Whence): [Result, number] {
    const file = this.openMap.get(fd)!;
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF, 0];
    }

    return [Result.SUCCESS, file.seek(offset, whence)];
  }

  tell(fd: FileDescriptor): [Result, number] {
    const file = this.openMap.get(fd)!;
    if (!file || file instanceof OpenDirectory) {
      return [Result.EBADF, 0];
    }

    return [Result.SUCCESS, file.tell()];
  }
}

class OpenFile {
  file: WASIFile;
  buffer: Uint8Array;
  offset: number = 0;
  isDirty: boolean = false;

  constructor(file: WASIFile) {
    this.file = file;

    if (this.file.mode === "string") {
      const encoder = new TextEncoder();
      this.buffer = encoder.encode(this.file.content);
    } else {
      this.buffer = new Uint8Array(this.file.content);
    }
  }

  read(bytes: number) {
    const ret = new Uint8Array(
      this.buffer.subarray(this.offset, this.offset + bytes)
    );
    this.offset += bytes;
    return ret;
  }

  write(data: Uint8Array) {
    this.isDirty = true;
    const bytes = data.byteLength;
    if (this.offset + bytes > this.buffer.byteLength) {
      const newBuffer = new Uint8Array(this.offset + bytes);
      newBuffer.set(this.buffer);
      newBuffer.set(data, this.offset);
      this.buffer = newBuffer;
    }

    this.buffer.set(data, this.offset);
    this.offset += data.byteLength;
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
      case Whence.END:
        this.offset = this.buffer.byteLength + Number(offset);
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
