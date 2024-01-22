import "./style.css";
import { WASI, WASIContext } from "../lib/main";

(window as any)["WASI"] = WASI;
(window as any)["WASIContext"] = WASIContext;

const programSelect = document.getElementById("program")! as HTMLSelectElement;
const argsInput = document.getElementById("args")! as HTMLInputElement;
const runButton = document.getElementById("run")! as HTMLButtonElement;
const runReactorButton = document.getElementById(
  "run-reactor"
)! as HTMLButtonElement;

const exitCode = document.getElementById("exit-code")! as HTMLElement;
const stdoutPre = document.getElementById("stdout")! as HTMLPreElement;
const stderrPre = document.getElementById("stderr")! as HTMLPreElement;

runButton.addEventListener("click", async () => {
  stdoutPre.textContent = "";
  stderrPre.textContent = "";

  const url = programSelect.value;

  const argsString = argsInput.value;

  const result = await WASI.start(
    fetch(url),
    new WASIContext({
      args: argsString ? argsInput.value.split(" ") : [],
      stdout: (out) => (stdoutPre.textContent += out),
      stderr: (err) => (stderrPre.textContent += err),
      stdin: () => prompt("stdin (cancel to end stdin):"),
      fs: {
        "foo.txt": {
          path: "foo/foo.txt",
          timestamps: {
            access: new Date(),
            change: new Date(),
            modification: new Date(),
          },
          mode: "string",
          content: "gday odin\nhow are you goen?\n",
        },
        "foo/gday.txt": {
          path: "foo/gday.txt",
          timestamps: {
            access: new Date(),
            change: new Date(),
            modification: new Date(),
          },
          mode: "string",
          content: "gday odin\nhow are you goen?\n",
        },
        "foo/champ/hello.txt": {
          path: "foo/champ/hello.txt",
          timestamps: {
            access: new Date(),
            change: new Date(),
            modification: new Date(),
          },
          mode: "string",
          content: "gday odin\nhow are you goen?\n",
        },
      },
    })
  );
  exitCode.textContent = result.exitCode.toString();
});

runReactorButton.addEventListener("click", async () => {
  stdoutPre.textContent = "";
  stderrPre.textContent = "";

  const url = programSelect.value;
  const exports = await WASI.initialize(fetch(url));

  // This is very specific to the current reactor
  // but I just want a simple e2e test. Write something a bit more general
  // when there are more reactor tests.
  exitCode.textContent = (exports.return_57 as Function)();
});
