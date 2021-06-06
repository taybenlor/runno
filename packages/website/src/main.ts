const runButton = document.getElementById("run") as HTMLButtonElement;
const codeEl = document.getElementById("code") as HTMLTextAreaElement;
const runtimeIframe = document.getElementById("runtime") as HTMLIFrameElement;

runButton.addEventListener("click", function () {
  const code = codeEl.value;
  const encodedCode = encodeURIComponent(code);
  runtimeIframe.src = `http://localhost:1234/?runtime=python&code=${encodedCode}`;
});
