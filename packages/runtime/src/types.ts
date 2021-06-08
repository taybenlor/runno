export type Runtime = "python" | "quickjs";
export type ResultFS = {
  stdin: string;
  stdout: string;
  stderr: string;
  terminal: string;
  fs: FS;
};

export type FS = {
  [name: string]: File;
};

export type File = {
  name: string;
  content: string | Uint8Array;
};

export type RuntimeMethods = {
  interactiveRunCode: (runtime: Runtime, code: string) => Promise<ResultFS>;
  interactiveRunFS: (
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ) => Promise<ResultFS>;
  interactiveUnsafeCommand: (command: string, fs: FS) => Promise<ResultFS>;

  headlessRunCode: (runtime: Runtime, code: string) => Promise<ResultFS>;
  headlessRunFS: (
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ) => Promise<ResultFS>;
  headlessUnsafeCommand: (command: string, fs: FS) => Promise<ResultFS>;
};
