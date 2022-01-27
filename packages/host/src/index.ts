import { ParentHandshake, RemoteHandle, WindowMessenger } from "post-me";
import { Runtime, RuntimeMethods, RunResult, FS, Syntax } from "./types";
import { encode } from "url-safe-base64";

export function generateEmbedURL(
  code: string,
  runtime: string,
  options?: {
    showControls?: boolean; // Default: true
    showEditor?: boolean; // Default: true
    autorun?: boolean; // Default: false
    baseUrl?: string; // Default: "https://runno.run/"
  }
): URL {
  const showEditor =
    options?.showEditor === undefined ? true : options?.showEditor;
  const showControls =
    options?.showControls === undefined ? true : options?.showControls;
  const autorun = options?.autorun || false;
  const baseUrl = options?.baseUrl || "https://runno.run/";
  const url = new URL(baseUrl);
  if (showEditor) {
    url.searchParams.append("editor", "1");
  }
  if (autorun) {
    url.searchParams.append("autorun", "1");
  }
  if (!showControls) {
    url.searchParams.append("controls", "0");
  }
  url.searchParams.append("runtime", runtime);
  url.searchParams.append("code", encode(btoa(code)));
  return url;
}

export function generateEmbedHTML(url: URL): string {
  return `<iframe src="${url}" crossorigin allow="cross-origin-isolated" width="640" height="320" frameBorder="0"></iframe>`;
}

export function runtimeToSyntax(runtime: string | undefined | null): Syntax {
  if (runtime == "python") {
    return "python";
  }
  if (runtime == "quickjs") {
    return "js";
  }
  if (runtime == "sqlite") {
    return "sql";
  }
  if (runtime == "clang") {
    return "cpp";
  }
  if (runtime == "clangpp") {
    return "cpp";
  }
  if (runtime == "ruby") {
    return "ruby";
  }
  return undefined;
}

export class RunnoHost implements RuntimeMethods {
  remoteHandle: RemoteHandle<RuntimeMethods>;
  constructor(remoteHandle: RemoteHandle<RuntimeMethods>) {
    this.remoteHandle = remoteHandle;
  }

  showControls(): Promise<void> {
    return this.remoteHandle.call("showControls");
  }

  hideControls(): Promise<void> {
    return this.remoteHandle.call("hideControls");
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

  getEditorProgram(): Promise<string> {
    return this.remoteHandle.call("getEditorProgram");
  }

  interactiveRunCode(runtime: Runtime, code: string): Promise<RunResult> {
    return this.remoteHandle.call("interactiveRunCode", runtime, code);
  }

  interactiveRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS
  ): Promise<RunResult> {
    return this.remoteHandle.call("interactiveRunFS", runtime, entryPath, fs);
  }

  interactiveUnsafeCommand(command: string, fs: FS): Promise<RunResult> {
    return this.remoteHandle.call("interactiveUnsafeCommand", command, fs);
  }

  interactiveStop(): Promise<void> {
    return this.remoteHandle.call("interactiveStop");
  }

  headlessRunCode(
    runtime: Runtime,
    code: string,
    stdin?: string
  ): Promise<RunResult> {
    return this.remoteHandle.call("headlessRunCode", runtime, code, stdin);
  }

  headlessRunFS(
    runtime: Runtime,
    entryPath: string,
    fs: FS,
    stdin?: string
  ): Promise<RunResult> {
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
  ): Promise<RunResult> {
    return this.remoteHandle.call("headlessUnsafeCommand", command, fs, stdin);
  }
}

export async function ConnectRunno(
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
