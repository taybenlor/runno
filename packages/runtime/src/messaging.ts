import { ChildHandshake, WindowMessenger } from "post-me";
import { RunnoProvider } from "./provider";
import { RuntimeMethods } from "./types";

const messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: window.parent,
  remoteOrigin: "*",
});

export function createConnection(provider: RunnoProvider) {
  return ChildHandshake<RuntimeMethods>(messenger, provider);
}
