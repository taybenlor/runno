import type { WASIFS } from "@runno/wasi";

export type Runtime =
  | "python"
  | "quickjs"
  | "sqlite"
  | "clang"
  | "clangpp"
  | "ruby"
  | "php-cgi";
export type Syntax =
  | "python"
  | "js"
  | "sql"
  | "cpp"
  | "ruby"
  | "php"
  | "html"
  | undefined;

export type CrashResult = {
  resultType: "crash";
  error: {
    message: string;
    type: string;
  };
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

export type TerminatedResult = {
  resultType: "terminated";
};

export type TimeoutResult = {
  resultType: "timeout";
};

export type RunResult =
  | CompleteResult
  | CrashResult
  | TerminatedResult
  | TimeoutResult;

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
