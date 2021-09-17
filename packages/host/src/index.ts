import { ParentHandshake, RemoteHandle, WindowMessenger } from "post-me";
import { Runtime, RuntimeMethods, CommandResult, FS, Syntax } from "./types";

export class RunnoError extends Error {}

export class RunnoHost {
  remoteHandle: RemoteHandle<RuntimeMethods>;
  constructor(remoteHandle: RemoteHandle<RuntimeMethods>) {
    this.remoteHandle = remoteHandle;
  }

  showEditor(): Promise<void> {
    return this.remoteHandle.call("showEditor");
  }

  hideEditor(): Promise<void> {
    return this.remoteHandle.call("hideEditor");
  }

  setEditorProgram(
    syntax: Syntax,
    runtime: Runtime,
    code: string
  ): Promise<void> {
    return this.remoteHandle.call("setEditorProgram", syntax, runtime, code);
  }

  interactiveRunCode(runtime: Runtime, code: string): Promise<CommandResult> {
    return this.remoteHandle.call("interactiveRunCode", runtime, code);
  }

  interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<CommandResult> {
    return this.remoteHandle.call("interactiveRunFS", runtime, entryPath, fs);
  }

  interactiveUnsafeCommand(command: string, fs: FS): Promise<CommandResult> {
    return this.remoteHandle.call("interactiveUnsafeCommand", command, fs);
  }

  headlessRunCode(
    runtime: Runtime,
    code: string,
    stdin?: string
  ): Promise<CommandResult> {
    return this.remoteHandle.call("headlessRunCode", runtime, code, stdin);
  }

  headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS,
    stdin?: string
  ): Promise<CommandResult> {
    return this.remoteHandle.call(
      "headlessRunFS",
      runtime,
      entryPath,
      fs,
      stdin
    );
  }

  headlessUnsafeCommand(
    command: string,
    fs: FS,
    stdin?: string
  ): Promise<CommandResult> {
    return this.remoteHandle.call("headlessUnsafeCommand", command, fs, stdin);
  }
}

export default async function ConnectRunno(
  iframe: HTMLIFrameElement
): Promise<RunnoHost> {
  const childWindow = iframe.contentWindow;

  if (!childWindow) {
    throw new Error("ConnectRunno: iframe contentWindow must be defined");
  }

  const messenger = new WindowMessenger({
    localWindow: window,
    remoteWindow: childWindow,
    remoteOrigin: "*",
  });

  const connection = await ParentHandshake<RuntimeMethods>(messenger);

  return new RunnoHost(connection.remoteHandle());
}

export * from "./types";
