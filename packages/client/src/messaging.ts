import { ChildHandshake, WindowMessenger } from "post-me";
import { RuntimeMethods } from "@runno/runtime";

const messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: window.parent,
  remoteOrigin: "*",
});

export function createConnection(provider: RuntimeMethods) {
  return ChildHandshake<RuntimeMethods>(messenger, provider);
}
