import { Result, Whence } from "./snapshot-preview1";
import { WASIFile, WASIFS, WASIPath } from "./types";

type FileDescriptor = number;

export class WASIDrive {
  fs: WASIFS;
  nextFD: FileDescriptor = 10;
  openMap: Map<FileDescriptor, OpenFile> = new Map<FileDescriptor, OpenFile>();

  constructor(fs: WASIFS) {
    this.fs = { ...fs };
  }

  open(fdDir: FileDescriptor, path: WASIPath): Result {
    if (!(path in this.fs)) {
      return Result.ENOENT;
    }

    const file = new OpenFile(this.fs[path]);
    this.openMap.set(this.nextFD, file);
    this.nextFD++;
    return Result.SUCCESS;
  }

  close(fd: FileDescriptor): Result {
    if (!this.openMap.has(fd)) {
      return Result.EBADF;
    }

    const file = this.openMap.get(fd)!;
    file.sync();
    this.openMap.delete(fd);
    return Result.SUCCESS;
  }

  read(fd: FileDescriptor, bytes: number): Result | Uint8Array {
    if (!this.openMap.has(fd)) {
      return Result.EBADF;
    }

    const file = this.openMap.get(fd)!;
    return file.read(bytes);
  }

  write(fd: FileDescriptor, data: Uint8Array): Result {
    if (!this.openMap.has(fd)) {
      return Result.EBADF;
    }

    const file = this.openMap.get(fd)!;
    file.write(data);
    return Result.SUCCESS;
  }

  sync(fd: FileDescriptor): Result {
    if (!this.openMap.has(fd)) {
      return Result.EBADF;
    }

    const file = this.openMap.get(fd)!;
    file.sync();
    return Result.SUCCESS;
  }

  seek(fd: FileDescriptor, offset: bigint, whence: Whence): [Result, number] {
    if (!this.openMap.has(fd)) {
      return [Result.EBADF, 0];
    }

    const file = this.openMap.get(fd)!;
    return [Result.SUCCESS, file.seek(offset, whence)];
  }

  tell(fd: FileDescriptor): [Result, number] {
    if (!this.openMap.has(fd)) {
      return [Result.EBADF, 0];
    }

    const file = this.openMap.get(fd)!;
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
