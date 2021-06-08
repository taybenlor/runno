import { ParentHandshake, WindowMessenger } from "post-me";

const runButton = document.getElementById("run") as HTMLButtonElement;
const codeEl = document.getElementById("code") as HTMLTextAreaElement;
const runtimeIframe = document.getElementById("runtime") as HTMLIFrameElement;
const runtimeWindow = runtimeIframe.contentWindow!;

// For safety it is strongly adviced to pass the explicit child origin instead of '*'
const messenger = new WindowMessenger({
  localWindow: window,
  remoteWindow: runtimeWindow,
  remoteOrigin: "*",
});

ParentHandshake(messenger).then((connection) => {
  const remoteHandle = connection.remoteHandle();

  runButton.addEventListener("click", function () {
    const code = codeEl.value;

    remoteHandle.call("interactiveRunCode", "python", code);
  });
});
