import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { ruby } from "runno-codemirror-lang-ruby";
import { sql } from "@codemirror/lang-sql";
import { cpp } from "@codemirror/lang-cpp";
import { php } from "@codemirror/lang-php";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, tags as t } from "@codemirror/highlight";
import { EditorView } from "@codemirror/basic-setup";
import { Syntax } from "@runno/host";

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

export const theme = EditorView.theme({
  ".cm-gutters": {
    backgroundColor: "white",
    border: "none",
  },
  ".cm-focused": {
    outline: "none",
  },
});

export function syntaxToExtensions(syntax: Syntax) {
  switch (syntax) {
    case "python":
      return [python()];
    case "ruby":
      return [ruby()];
    case "js":
      return [javascript()];
    case "sql":
      return [sql()];
    case "cpp":
      return [cpp()];
    case "php":
      return [php()];
    case "html":
      return [html()];
  }
  return [];
}
