import "./main.css";

import "./pages/home";
import "./pages/docs";
import "./pages/playground";

import "./components/route";

import { defineElements } from "@runno/runtime";
import { VersionElement } from "./version";
import { ScrollHighlightElement } from "./scroll-highlight";

defineElements();
customElements.define("runno-version", VersionElement);
customElements.define("runno-scroll-highlight", ScrollHighlightElement);
