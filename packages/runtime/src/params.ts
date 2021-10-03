import { decode } from "url-safe-base64";

import { RunnoProvider } from "./provider";
import { Runtime, Syntax } from "@runno/host";

function isTruthy(param: string | null | undefined) {
  if (param === null || param === undefined) {
    return false;
  }

  if (param.toLowerCase() == "false") {
    return false;
  }

  if (!isNaN(param as any)) {
    return !!parseInt(param, 10);
  }

  return true;
}

function runtimeToSyntax(runtime: string | undefined | null): Syntax {
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
  return undefined;
}

export function handleParams(provider: RunnoProvider) {
  const hash = window.location.hash.slice(1);
  const search = window.location.search.slice(1);
  const urlParams = `${hash}&${search}`;
  const params = new URLSearchParams(urlParams);

  const code = params.get("code") ? atob(decode(params.get("code")!)) : "";
  const command = params.get("command");
  const runtimeName = params.get("runtime");
  const showEditor = isTruthy(params.get("editor"));
  const autorun = isTruthy(params.get("autorun"));

  if (runtimeName && code) {
    // TODO: Handle invalid runtimeName
    provider.setEditorProgram(
      runtimeToSyntax(runtimeName),
      runtimeName as Runtime,
      code
    );
  }

  if (showEditor) {
    provider.showEditor();
  }

  if (autorun && runtimeName) {
    provider.interactiveRunCode(runtimeName as Runtime, code);
  }

  if (command) {
    provider.interactiveUnsafeCommand(command, {
      code: {
        name: "code",
        content: code,
      },
    });
  }
}
