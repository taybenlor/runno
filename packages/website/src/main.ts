import ConnectRunno, { Runtime, RunnoHost } from "@runno/host";
import { StarfieldElement } from "./starfield";

// Define this custom element
customElements.define("runno-starfield", StarfieldElement);

const runButton = document.getElementById("run") as HTMLButtonElement;
const headlessButton = document.getElementById(
  "run-headless"
) as HTMLButtonElement;
const runtimeSelect = document.getElementById(
  "runtime-select"
) as HTMLSelectElement;
const codeEl = document.getElementById("code") as HTMLTextAreaElement;
const headlessStdinEl = document.getElementById(
  "headless-stdin"
) as HTMLTextAreaElement;
const stdoutEl = document.getElementById("stdout") as HTMLPreElement;
const stderrEl = document.getElementById("stderr") as HTMLPreElement;
const stdinEl = document.getElementById("stdin") as HTMLPreElement;
const ttyEl = document.getElementById("tty") as HTMLPreElement;
const runtimeIframe = document.getElementById("runtime") as HTMLIFrameElement;
runtimeIframe.src = import.meta.env.VITE_RUNTIME;

runtimeIframe.addEventListener("load", () => {
  ConnectRunno(runtimeIframe).then((runno: RunnoHost) => {
    runButton.addEventListener("click", async function () {
      const code = codeEl.value;

      const { stdin, stdout, stderr, tty } = await runno.interactiveRunCode(
        runtimeSelect.value as Runtime,
        code
      );

      stdoutEl.textContent = stdout;
      stdinEl.textContent = stdin;
      stderrEl.textContent = stderr;
      ttyEl.textContent = tty;
    });

    headlessButton.addEventListener("click", async function () {
      const code = codeEl.value;
      const codeStdin = headlessStdinEl.value;

      const { stdin, stdout, stderr, tty } = await runno.headlessRunCode(
        runtimeSelect.value as Runtime,
        code,
        codeStdin
      );

      stdoutEl.textContent = stdout;
      stdinEl.textContent = stdin;
      stderrEl.textContent = stderr;
      ttyEl.textContent = tty;
    });
  });
});
