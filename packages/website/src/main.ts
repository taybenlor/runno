import { StarfieldElement } from "./starfield";

function generateEmbedURL(code: string, runtime: string, showEditor: boolean) {
  const url = new URL(import.meta.env.VITE_RUNTIME);
  if (showEditor) {
    url.searchParams.append("editor", showEditor ? "1" : "0");
  }
  url.searchParams.append("runtime", runtime);
  url.searchParams.append("code", code);
  return url;
}

function generateEmbedHTML(url: URL) {
  return `<iframe src="${url}" crossorigin allow="cross-origin-isolated"></iframe>`;
}

// Define this custom element
customElements.define("runno-starfield", StarfieldElement);

const codeText = document.getElementById("code") as HTMLTextAreaElement;
const runtimeSelect = document.getElementById(
  "runtime-select"
) as HTMLSelectElement;
const editorCheckbox = document.getElementById(
  "editor-checkbox"
) as HTMLInputElement;
const embedText = document.getElementById("embed") as HTMLTextAreaElement;
const runtimeIframe = document.getElementById("runtime") as HTMLIFrameElement;

function updateState() {
  const embedURL = generateEmbedURL(
    codeText.value,
    runtimeSelect.value,
    editorCheckbox.checked
  );
  embedText.value = generateEmbedHTML(embedURL);
  runtimeIframe.src = embedURL.toString();
}

codeText.addEventListener("input", updateState);
runtimeSelect.addEventListener("input", updateState);
editorCheckbox.addEventListener("input", updateState);

updateState();
