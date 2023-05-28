export type Runtime =
  | "python"
  | "quickjs"
  | "sqlite"
  | "clang"
  | "clangpp"
  | "ruby";
export type Syntax = "python" | "js" | "sql" | "cpp" | "ruby" | undefined;

export type CrashResult = {
  resultType: "crash";
  error: unknown;
};

export type CompleteResult = {
  resultType: "complete";
  stdin: string;
  stdout: string;
  stderr: string;
  tty: string;
  fs: WASIFS;
  exitCode: number;
};

export type RunResult = CompleteResult | CrashResult;

export type WASIPath = string;

export type WASIFS = {
  [path: WASIPath]: WASIFile;
};

export type WASITimestamps = {
  access: Date;
  modification: Date;
  change: Date;
};

export type WASIFile = {
  path: WASIPath; // TODO: This duplication is annoying, lets remove it
  timestamps: WASITimestamps;
} & (
  | {
      mode: "string";
      content: string;
    }
  | {
      mode: "binary";
      content: Uint8Array;
    }
);

export type WASIExecutionResult = {
  exitCode: number;
  fs: WASIFS;
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
    fs: WASIFS
  ) => Promise<RunResult>;

  interactiveStop: () => void;

  headlessRunCode: (
    runtime: Runtime,
    code: string,
    stdin?: string
  ) => Promise<RunResult>;

  headlessRunFS: (
    runtime: Runtime,
    entryPath: string,
    fs: WASIFS,
    stdin?: string
  ) => Promise<RunResult>;
};
