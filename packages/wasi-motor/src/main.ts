import "./style.css";
import { WASI } from "../lib/main";

// TODO: Provide UI for changing test binaries
const programSelect = document.getElementById("program")! as HTMLSelectElement;
const runButton = document.getElementById("run")! as HTMLButtonElement;
runButton.addEventListener("click", async () => {
  const url = programSelect.value;

  // TODO: Rewrite WASI Motor API to work with actual WASM apis lol
  WASI.start(fetch(url), {});
});
