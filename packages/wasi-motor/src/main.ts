import "./style.css";
import { WASI } from "../lib/main";

// TODO: Provide UI for changing test binaries
const programSelect = document.getElementById("program")! as HTMLSelectElement;
const argsInput = document.getElementById("args")! as HTMLInputElement;
const runButton = document.getElementById("run")! as HTMLButtonElement;

const exitCode = document.getElementById("exit-code")! as HTMLElement;

runButton.addEventListener("click", async () => {
  const url = programSelect.value;

  const argsString = argsInput.value;

  const result = await WASI.start(fetch(url), {
    drive: {},
    args: argsString ? argsInput.value.split(" ") : [],
    env: {},
  });
  exitCode.textContent = result.toString();
});
