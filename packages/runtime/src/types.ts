export type Runtime = "python" | "quickjs" | "sqlite";
export type CommandResult = {
  stdin: string;
  stdout: string;
  stderr: string;
  tty: string;
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
  interactiveRunCode: (
    runtime: Runtime,
    code: string
  ) => Promise<CommandResult>;
  interactiveRunFS: (
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ) => Promise<CommandResult>;
  interactiveUnsafeCommand: (command: string, fs: FS) => Promise<CommandResult>;

  headlessRunCode: (runtime: Runtime, code: string) => Promise<CommandResult>;
  headlessRunFS: (
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ) => Promise<CommandResult>;
  headlessUnsafeCommand: (command: string, fs: FS) => Promise<CommandResult>;
};
