import packageJson from "../package.json";

export class VersionElement extends HTMLElement {
  constructor() {
    super();

    this.textContent = packageJson.version;
  }
}
