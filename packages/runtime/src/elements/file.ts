import { WASIFile } from "@runno/wasi";
import { elementCodeContent } from "../helpers";

type DateAttribute = "access" | "modification" | "change";
type Attribute = "path" | DateAttribute;

const ATTRIBUTES: Attribute[] = ["path", "access", "modification", "change"];
const DATE_ATTRIBUTES: DateAttribute[] = ["access", "modification", "change"];

function isDateAttribute(name: string): name is DateAttribute {
  return name in DATE_ATTRIBUTES;
}

export class FileElement extends HTMLElement {
  static get observedAttributes() {
    return ATTRIBUTES;
  }

  path: string = "tmp" + Math.floor(Math.random() * 10000).toString();

  access: Date = new Date();
  modification: Date = new Date();
  change: Date = new Date();

  _content: string = "";
  get content() {
    return this._content || elementCodeContent(this);
  }

  set content(content: string) {
    this._content = content;
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot!.innerHTML = `
    <style>
      :host {
        display: none;
      }
    </style>
    <pre hidden><slot></slot></pre>
    `;
  }

  //
  // Public Helpers
  //

  getFile(): WASIFile {
    return {
      path: this.path,
      mode: "string",
      content: this.content,
      timestamps: {
        access: this.access,
        modification: this.modification,
        change: this.change,
      },
    };
  }

  //
  // Lifecycle Methods
  //

  attributeChangedCallback(
    name: Attribute,
    _oldValue: string,
    newValue: string
  ) {
    if (isDateAttribute(name)) {
      this[name] = new Date(newValue);
    } else {
      this[name] = newValue;
    }
  }
}

customElements.define("runno-file", FileElement);
