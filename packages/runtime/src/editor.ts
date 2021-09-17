import { EditorState, EditorView, basicSetup } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { HighlightStyle, tags as t } from "@codemirror/highlight";
import { Runtime, Syntax } from "./types";

type RunCallback = (runtime: Runtime, code: string) => void;

// TODO: This is just the one-dark theme colors on a light background
// Need to find some new colours, or pick some of my own
// https://github.com/dempfi/ayu
// Might be a better fit
//
const chalky = "#e5c07b",
  coral = "#e06c75",
  cyan = "#56b6c2",
  invalid = "#ffffff",
  ivory = "#abb2bf",
  stone = "#7d8799",
  malibu = "#61afef",
  sage = "#98c379",
  whiskey = "#d19a66",
  violet = "#c678dd";

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
  return [basicSetup, theme, highlightStyle];
}

export class Editor {
  container: HTMLElement;
  editor: HTMLElement;
  runButton: HTMLButtonElement;
  view: EditorView;
  runtime: Runtime | undefined;
  runCallbacks: RunCallback[] = [];

  set hidden(hidden: boolean) {
    this.container.hidden = hidden;
  }

  get hidden() {
    return this.container.hidden;
  }

  constructor(container: HTMLElement) {
    this.container = container;
    this.editor = container.querySelector("#code-editor")!;
    this.runButton = container.querySelector("#run")!;

    this.view = new EditorView({
      state: EditorState.create({ extensions: syntaxToExtensions(undefined) }),
      parent: this.editor,
    });

    this.runButton.addEventListener("click", () => {
      if (this.runtime == undefined) {
        return;
      }

      for (const callback of this.runCallbacks) {
        callback(this.runtime, this.view.state.doc.toString());
      }
    });
  }

  addRunCallback(callback: RunCallback) {
    this.runCallbacks.push(callback);
  }

  setProgram(syntax: Syntax, runtime: Runtime, code: string) {
    this.runtime = runtime;
    this.view.setState(
      EditorState.create({
        doc: code,
        extensions: syntaxToExtensions(syntax),
      })
    );
  }

  show() {
    this.container.hidden = false;
  }

  hide() {
    this.container.hidden = true;
  }
}
