import { ParentHandshake, WindowMessenger } from "post-me";

const runButton = document.getElementById("run") as HTMLButtonElement;
const runtimeSelect = document.getElementById(
  "runtime-select"
) as HTMLSelectElement;
const codeEl = document.getElementById("code") as HTMLTextAreaElement;
const stdoutEl = document.getElementById("stdout") as HTMLPreElement;
const stderrEl = document.getElementById("stderr") as HTMLPreElement;
const stdinEl = document.getElementById("stdin") as HTMLPreElement;
const ttyEl = document.getElementById("tty") as HTMLPreElement;
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

  runButton.addEventListener("click", async function () {
    const code = codeEl.value;

    const { stdin, stdout, stderr, tty } = await remoteHandle.call(
      "interactiveRunCode",
      runtimeSelect.value,
      code
    );

    stdoutEl.textContent = stdout;
    stdinEl.textContent = stdin;
    stderrEl.textContent = stderr;
    ttyEl.textContent = tty;

    console.log("Resulting STDOUT", stdout);
  });
});
