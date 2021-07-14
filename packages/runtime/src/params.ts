import { Terminal } from "./terminal";
import { TerminalProvider } from "./messaging";
import { Runtime } from "./types";

export function handleParams(terminal: Terminal) {
  const hash = window.location.hash.slice(1);
  const search = window.location.search.slice(1);
  const urlParams = `${hash}&${search}`;
  const params = new URLSearchParams(urlParams);

  const provider = new TerminalProvider(terminal);

  const code = params.get("code") || "";
  const command = params.get("command");
  const runtimeName = params.get("runtime");

  if (runtimeName) {
    provider.interactiveRunCode(runtimeName as Runtime, code);
  } else if (command) {
    provider.interactiveUnsafeCommand(command, {
      code: {
        name: "code",
        content: code,
      },
    });
  } else {
    // No command was specified
    return;
  }

  terminal.focus();
}
