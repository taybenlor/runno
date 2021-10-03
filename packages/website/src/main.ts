import { StarfieldElement } from "./starfield";
import { encode } from "url-safe-base64";
import { exampleForRuntime } from "./examples";
import { Runtime } from "@runno/host";

function generateEmbedURL(
  code: string,
  runtime: string,
  showEditor: boolean,
  autoRun: boolean
) {
  const url = new URL(import.meta.env.VITE_RUNTIME);
  if (showEditor) {
    url.searchParams.append("editor", "1");
  }
  if (autoRun) {
    url.searchParams.append("autorun", "1");
  }
  url.searchParams.append("runtime", runtime);
  url.searchParams.append("code", encode(btoa(code)));
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
const autorunCheckbox = document.getElementById(
  "autorun-checkbox"
) as HTMLInputElement;
const embedText = document.getElementById("embed") as HTMLTextAreaElement;
const runtimeIframe = document.getElementById("runtime") as HTMLIFrameElement;

let lastRuntime = runtimeSelect.value;
function updateState() {
  if (
    codeText.value.trim() == exampleForRuntime(lastRuntime as Runtime).trim()
  ) {
    codeText.value = exampleForRuntime(runtimeSelect.value as Runtime);
  }

  const embedURL = generateEmbedURL(
    codeText.value,
    runtimeSelect.value,
    editorCheckbox.checked,
    autorunCheckbox.checked
  );
  embedText.value = generateEmbedHTML(embedURL);
  runtimeIframe.src = embedURL.toString();
  lastRuntime = runtimeSelect.value;
}

codeText.addEventListener("input", updateState);
runtimeSelect.addEventListener("input", updateState);
editorCheckbox.addEventListener("input", updateState);
autorunCheckbox.addEventListener("input", updateState);

updateState();
