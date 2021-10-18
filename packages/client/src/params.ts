import { decode } from "url-safe-base64";

import { Runtime, RuntimeMethods, runtimeToSyntax } from "@runno/host";

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

export function handleParams(provider: RuntimeMethods) {
  const hash = window.location.hash.slice(1);
  const search = window.location.search.slice(1);
  const urlParams = `${hash}&${search}`;
  const params = new URLSearchParams(urlParams);

  const code = params.get("code") ? atob(decode(params.get("code")!)) : "";
  const command = params.get("command");
  const runtimeName = params.get("runtime");
  const showEditor = isTruthy(params.get("editor"));
  const autorun = isTruthy(params.get("autorun"));
  let showControls = true;
  if (params.has("controls")) {
    showControls = isTruthy(params.get("controls"));
  }

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

  if (showControls) {
    provider.showControls();
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
