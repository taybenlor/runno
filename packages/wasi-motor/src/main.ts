import "./style.css";
import { WASI, WASIContext } from "../lib/main";

// TODO: Provide UI for changing test binaries
const programSelect = document.getElementById("program")! as HTMLSelectElement;
const argsInput = document.getElementById("args")! as HTMLInputElement;
const runButton = document.getElementById("run")! as HTMLButtonElement;

const exitCode = document.getElementById("exit-code")! as HTMLElement;
const stdoutPre = document.getElementById("stdout")! as HTMLPreElement;
const stderrPre = document.getElementById("stderr")! as HTMLPreElement;

runButton.addEventListener("click", async () => {
  const url = programSelect.value;

  const argsString = argsInput.value;

  const result = await WASI.start(
    fetch(url),
    new WASIContext({
      args: argsString ? argsInput.value.split(" ") : [],
      stdout: (out) => (stdoutPre.textContent += out),
      stderr: (err) => (stderrPre.textContent += err),
    })
  );
  exitCode.textContent = result.toString();
});
