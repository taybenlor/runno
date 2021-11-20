import { StarfieldElement } from "./starfield";
import { exampleForRuntime } from "./examples";
import { Runtime, generateEmbedURL, generateEmbedHTML } from "@runno/host";
import { defineElements } from "@runno/runtime";
import { VersionElement } from "./version";
import { ScrollHighlightElement } from "./scroll-highlight";

defineElements();
customElements.define("runno-starfield", StarfieldElement);
customElements.define("runno-version", VersionElement);
customElements.define("runno-scroll-highlight", ScrollHighlightElement);

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

  const embedURL = generateEmbedURL(codeText.value, runtimeSelect.value, {
    showEditor: editorCheckbox.checked,
    autorun: autorunCheckbox.checked,
    baseUrl: import.meta.env.VITE_RUNTIME,
  });
  embedText.value = generateEmbedHTML(embedURL);
  runtimeIframe.src = embedURL.toString();
  lastRuntime = runtimeSelect.value;
}

codeText.addEventListener("input", updateState);
runtimeSelect.addEventListener("input", updateState);
editorCheckbox.addEventListener("input", updateState);
autorunCheckbox.addEventListener("input", updateState);

updateState();
