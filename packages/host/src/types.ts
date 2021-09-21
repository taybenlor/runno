export type Runtime = "python" | "quickjs" | "sqlite";
export type Syntax = "python" | "js" | "sql" | "cpp" | undefined;

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
  showEditor: () => void;

  hideEditor: () => void;

  setEditorProgram: (syntax: Syntax, runtime: Runtime, code: string) => void;

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

  headlessRunCode: (
    runtime: Runtime,
    code: string,
    stdin?: string
  ) => Promise<CommandResult>;

  headlessRunFS: (
    runtime: Runtime,
    entryPath: string,
    fs: FS,
    stdin?: string
  ) => Promise<CommandResult>;

  headlessUnsafeCommand: (
    command: string,
    fs: FS,
    stdin?: string
  ) => Promise<CommandResult>;
};
