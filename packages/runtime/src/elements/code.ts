import { EditorState, EditorView, basicSetup } from "@codemirror/basic-setup";
import { Syntax } from "@runno/host";
import { cmExtensions, cmHighlightStyle, elementCodeContent } from "../helpers";

const theme = EditorView.theme({
  ".cm-gutters": {
    backgroundColor: "white",
    border: "none",
  },
});

const extensions = [
  basicSetup,
  theme,
  cmHighlightStyle,
  EditorState.readOnly.of(true),
];

export class CodeElement extends HTMLElement {
  static get observedAttributes() {
    return ["syntax", "code"];
  }

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
      }
      :host {
        color: black;
      }
    </style>
    <pre hidden><slot></slot></pre>
    `;

    this.view = new EditorView({
      state: EditorState.create({
        doc: this.code,
        extensions: [...extensions, ...cmExtensions(undefined)],
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
          this.setProgram(this.syntax, this.code);
        }
      }
    }, 0);
  }

  attributeChangedCallback(name: string, oldValue: any, newValue: any) {
    (this as any)[name] = newValue;

    if (oldValue != newValue) {
      this.setProgram(this.syntax, this.code || this.program);
    }
  }

  setProgram(syntax: Syntax, code: string) {
    // TODO: The way I'm doing this is a bit of a weird hack
    this.code = undefined; // Editor is source of truth from now on
    this.view.setState(
      EditorState.create({
        doc: code,
        extensions: [...extensions, ...cmExtensions(syntax)],
      })
    );
  }
}
