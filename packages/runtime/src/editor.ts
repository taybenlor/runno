import { EditorState, EditorView, basicSetup } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { cpp } from "@codemirror/lang-cpp";
import { HighlightStyle, tags as t } from "@codemirror/highlight";
import { Runtime, Syntax, runtimeToSyntax } from "@runno/host";
import { elementCodeContent } from "./helpers";

// This is just the one-dark theme colors
// adjusted for a light background
//
const chalky = "#D3C101",
  coral = "#E3439D",
  cyan = "#2CB2C3",
  invalid = "#000000",
  ivory = "#8A909C",
  stone = "#B0B9C8",
  malibu = "#008CFF",
  sage = "#77CA3B",
  whiskey = "#E38730",
  violet = "#C067DA";

export const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: violet },
  {
    tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
    color: coral,
  },
  { tag: [t.function(t.variableName), t.labelName], color: malibu },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: whiskey },
  { tag: [t.definition(t.name), t.separator], color: ivory },
  {
    tag: [
      t.typeName,
      t.className,
      t.number,
      t.changed,
      t.annotation,
      t.modifier,
      t.self,
      t.namespace,
    ],
    color: chalky,
  },
  {
    tag: [
      t.operator,
      t.operatorKeyword,
      t.url,
      t.escape,
      t.regexp,
      t.link,
      t.special(t.string),
    ],
    color: cyan,
  },
  { tag: [t.meta, t.comment], color: stone },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: stone, textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: coral },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: whiskey },
  { tag: [t.processingInstruction, t.string, t.inserted], color: sage },
  { tag: t.invalid, color: invalid },
]);

const theme = EditorView.theme({
  ".cm-gutters": {
    backgroundColor: "white",
    border: "none",
  },
});

function syntaxToExtensions(syntax: Syntax) {
  if (syntax == "python") {
    return [basicSetup, theme, highlightStyle, python()];
  }
  if (syntax == "js") {
    return [basicSetup, theme, highlightStyle, javascript()];
  }
  if (syntax == "sql") {
    return [basicSetup, theme, highlightStyle, sql()];
  }
  if (syntax == "cpp") {
    return [basicSetup, theme, highlightStyle, cpp()];
  }
  return [basicSetup, theme, highlightStyle];
}

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
      }
    </style>
    <pre hidden><slot></slot></pre>
    `;

    this.view = new EditorView({
      state: EditorState.create({
        doc: this.code,
        extensions: syntaxToExtensions(undefined),
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
        extensions: syntaxToExtensions(syntax),
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
