import { ParentHandshake, RemoteHandle, WindowMessenger } from "post-me";
import { Runtime, RuntimeMethods, CommandResult, FS, Syntax } from "./types";
import { encode } from "url-safe-base64";

export function generateEmbedURL(
  code: string,
  runtime: string,
  options?: {
    showEditor?: boolean;
    autorun?: boolean;
    baseUrl?: string;
  }
) {
  const showEditor = options?.showEditor || true;
  const autorun = options?.autorun || false;
  const baseUrl = options?.baseUrl || "https://runno.run/";
  const url = new URL(baseUrl);
  if (showEditor) {
    url.searchParams.append("editor", "1");
  }
  if (autorun) {
    url.searchParams.append("autorun", "1");
  }
  url.searchParams.append("runtime", runtime);
  url.searchParams.append("code", encode(btoa(code)));
  return url;
}

export function generateEmbedHTML(url: URL) {
  return `<iframe src="${url}" crossorigin allow="cross-origin-isolated"></iframe>`;
}

export class RunnoHost implements RuntimeMethods {
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

  interactiveStop() {
    return this.remoteHandle.call("interactiveStop");
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
