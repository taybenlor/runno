import { WASIFile, WASIFS, WASIPath } from "./types";

type FileDescriptor = number;

export class WASIDrive {
  fs: WASIFS;
  nextFD: FileDescriptor = 10;
  openMap: Map<FileDescriptor, OpenFile> = new Map<FileDescriptor, OpenFile>();

  constructor(fs: WASIFS) {
    this.fs = { ...fs };
  }

  open(path: WASIPath): "success" | "not-found" | "already-open" {
    if (!(path in this.fs)) {
      return "not-found";
    }

    if (path in this.openMap.values) {
      return "already-open";
    }

    const file = new OpenFile(this.fs[path]);
    this.openMap.set(this.nextFD, file);
    this.nextFD++;
    return "success";
  }

  close(fd: FileDescriptor): "success" | "not-open" {
    if (!this.openMap.has(fd)) {
      return "not-open";
    }

    const file = this.openMap.get(fd)!;
    file.sync();
    this.openMap.delete(fd);
    return "success";
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
    return;
  }
}
