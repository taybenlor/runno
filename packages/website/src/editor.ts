import { ConnectRunno, Runtime, RunnoHost } from "@runno/host";

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

ConnectRunno(runtimeIframe).then((runno: RunnoHost) => {
  runButton.addEventListener("click", async function () {
    const code = codeEl.value;

    const { result } = await runno.interactiveRunCode(
      runtimeSelect.value as Runtime,
      code
    );

    if (result) {
      stdoutEl.textContent = result.stdout;
      stdinEl.textContent = result.stdin;
      stderrEl.textContent = result.stderr;
      ttyEl.textContent = result.tty;
    }
  });

  headlessButton.addEventListener("click", async function () {
    const code = codeEl.value;
    const codeStdin = headlessStdinEl.value;

    const { result } = await runno.headlessRunCode(
      runtimeSelect.value as Runtime,
      code,
      codeStdin
    );

    if (result) {
      stdoutEl.textContent = result.stdout;
      stdinEl.textContent = result.stdin;
      stderrEl.textContent = result.stderr;
      ttyEl.textContent = result.tty;
    }
  });
});
