export type Runtime =
  | "python"
  | "quickjs"
  | "sqlite"
  | "clang"
  | "clangpp"
  | "ruby";
export type Syntax = "python" | "js" | "sql" | "cpp" | "ruby" | undefined;

export type CommandResult = {
  stdin: string;
  stdout: string;
  stderr: string;
  tty: string;
  fs: FS;
  exit: number;
};

export type RunResult = {
  result?: CommandResult;
  prepare?: CommandResult;
};

export type FS = {
  [name: string]: File;
};

export type File = {
  name: string;
  content: string | Uint8Array;
};

export type RuntimeMethods = {
  showControls: () => void;

  hideControls: () => void;

  showEditor: () => void;

  hideEditor: () => void;

  setEditorProgram: (syntax: Syntax, runtime: Runtime, code: string) => void;

  getEditorProgram: () => Promise<string>;

  interactiveRunCode: (runtime: Runtime, code: string) => Promise<RunResult>;

  interactiveRunFS: (
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ) => Promise<RunResult>;

  interactiveUnsafeCommand: (command: string, fs: FS) => Promise<RunResult>;

  interactiveStop: () => void;

  headlessRunCode: (
    runtime: Runtime,
    code: string,
    stdin?: string
  ) => Promise<RunResult>;

  headlessRunFS: (
    runtime: Runtime,
    entryPath: string,
    fs: FS,
    stdin?: string
  ) => Promise<RunResult>;

  headlessUnsafeCommand: (
    command: string,
    fs: FS,
    stdin?: string
  ) => Promise<RunResult>;
};
