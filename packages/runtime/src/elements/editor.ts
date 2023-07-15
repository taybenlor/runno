import { EditorState, EditorView, basicSetup } from "@codemirror/basic-setup";

import { Runtime, Syntax, runtimeToSyntax } from "@runno/host";
import { elementCodeContent } from "../helpers";
import { highlightStyle, syntaxToExtensions, theme } from "./shared/codemirror";

const baseExtensions = [basicSetup, theme, highlightStyle];

export class EditorElement extends HTMLElement {
  static get observedAttributes() {
    return ["runtime", "syntax", "code"];
  }

  runtime?: Runtime;
  syntax?: Syntax;
  code?: string;

  private view: EditorView;

  get program(): string {
    return this.view.state.doc.toString();
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });

    this.shadowRoot!.innerHTML = `
    <style>
      .cm-editor {
        background: white;
        height: 100%;
        outline: none !important;
      }
    </style>
    <pre hidden><slot></slot></pre>
    `;

    this.view = new EditorView({
      state: EditorState.create({
        doc: this.code,
        extensions: [...baseExtensions, ...syntaxToExtensions(undefined)],
      }),
      root: this.shadowRoot!,
      parent: this.shadowRoot!,
    });
  }

  connectedCallback() {
    setTimeout(() => {
      if (!this.code) {
        const code = elementCodeContent(this);
        if (code.trim() != "") {
          this.code = code;
        }
      }
    }, 0);
  }

  attributeChangedCallback(name: string, oldValue: any, newValue: any) {
    (this as any)[name] = newValue;

    if (oldValue != newValue && this.runtime) {
      this.setProgram(this.syntax, this.runtime, this.code || this.program);
    }
  }

  setProgram(syntax: Syntax, runtime: Runtime, code: string) {
    this.runtime = runtime;

    if (!syntax) {
      syntax = runtimeToSyntax(runtime);
    }

    // TODO: The way I'm doing this is a bit of a weird hack
    this.code = undefined; // Editor is source of truth from now on
    this.view.setState(
      EditorState.create({
        doc: code,
        extensions: [...baseExtensions, ...syntaxToExtensions(syntax)],
      })
    );
  }

  show() {
    this.hidden = false;
  }

  hide() {
    this.hidden = true;
  }
}

customElements.define("runno-editor", EditorElement);
