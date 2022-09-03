import packageJSON from "../../package.json";

export class VersionElement extends HTMLElement {
  constructor() {
    super();

    this.textContent = packageJSON.version;
  }
}

customElements.define("runno-version", VersionElement);
declare global {
  interface HTMLElementTagNameMap {
    "runno-version": VersionElement;
  }
}
