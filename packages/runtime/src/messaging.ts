import { ChildHandshake, WindowMessenger } from "post-me";
import { RuntimeMethods, Runtime, ResultFS, FS } from "./types";
import { Terminal } from "./terminal";

const messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: window.parent,
  remoteOrigin: "*",
});

function commandForRuntime(name: string, entryPath: string) {
  if (name === "python") {
    return `python ${entryPath}`;
  }
  throw new Error(`Unknown runtime ${name}`);
}

class TerminalProvider {
  terminal: Terminal;
  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  //
  // Public Interface
  //

  async interactiveRunCode(runtime: Runtime, code: string): Promise<ResultFS> {
    return this.interactiveRunFS(runtime, "program", {
      program: { name: "program", content: code },
    });
  }

  interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<ResultFS> {
    const command = commandForRuntime(runtime, entryPath);
    return this.interactiveUnsafeCommand(command, fs);
  }

  interactiveUnsafeCommand(command: string, fs: FS): Promise<ResultFS> {
    for (const key of Object.keys(fs)) {
      this.terminal.writeFile(key, fs[key].content);
    }

    this.terminal.runCommand(command);
    this.terminal.focus();

    return Promise.resolve({
      stdin: "",
      stdout: "",
      stderr: "",
      terminal: "",
      fs: {},
    });
  }
  headlessRunCode(runtime: Runtime, code: string): Promise<ResultFS> {
    return Promise.resolve({
      stdin: "",
      stdout: "",
      stderr: "",
      terminal: "",
      fs: {},
    });
  }
  headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<ResultFS> {
    return Promise.resolve({
      stdin: "",
      stdout: "",
      stderr: "",
      terminal: "",
      fs: {},
    });
  }
  headlessUnsafeCommand(command: string, fs: FS): Promise<ResultFS> {
    return Promise.resolve({
      stdin: "",
      stdout: "",
      stderr: "",
      terminal: "",
      fs: {},
    });
  }

  //
  // Private Helpers
  //
}

export function createConnection(terminal: Terminal) {
  const provider = new TerminalProvider(terminal);
  return ChildHandshake<RuntimeMethods>(messenger, provider);
}
