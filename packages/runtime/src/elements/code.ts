import { EditorState, EditorView } from "@codemirror/basic-setup";
import { Syntax } from "@runno/host";
import { elementCodeContent } from "../helpers";
import { syntaxToExtensions } from "./shared/codemirror";

import { highlightSpecialChars, drawSelection } from "@codemirror/view";

import { rectangularSelection } from "@codemirror/rectangular-selection";
import {
  HighlightStyle,
  defaultHighlightStyle,
  tags as t,
} from "@codemirror/highlight";

const chalky = "#D3C101",
  coral = "#ff34b1",
  cyan = "#2CB2C3",
  invalid = "#000000",
  ivory = "#8A909C",
  stone = "#B0B9C8",
  malibu = "#008CFF",
  sage = "#77CA3B",
  whiskey = "#E38730",
  violet = "#C067DA",
  yellow = "#FFE234";

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
  { tag: t.tagName, color: yellow },
]);

const theme = EditorView.theme({
  ".cm-gutters": {
    backgroundColor: "var(--runno-code-background, #24292f)",
    border: "none",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "#030052",
  },
});

const baseExtensions = [
  highlightSpecialChars(),
  drawSelection(),
  defaultHighlightStyle.fallback,
  rectangularSelection(),
  theme,
  highlightStyle,
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
        background: var(--runno-code-background, #24292f);
        height: 100%;
        outline: none !important;
      }
      :host {
        display: block;
        color: rgb(229, 231, 235);
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
        extensions: [...baseExtensions, ...syntaxToExtensions(syntax)],
      })
    );
  }
}

customElements.define("runno-code", CodeElement);
