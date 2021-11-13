import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";

import { HighlightStyle, tags as t } from "@codemirror/highlight";

import { Syntax } from "@runno/host";

export function stripWhitespace(text: string): string {
  const lines = text.split(/\n/);
  let commonWhitespace = null;
  for (const line of lines) {
    if (line.match(/^\s*$/)) {
      // Skip lines that are only whitespace
      continue;
    }

    const leadingWhitespaceMatch = line.match(/^\s+/);
    if (leadingWhitespaceMatch === null) {
      commonWhitespace = "";
      break;
    }

    const leadingWhitespace = leadingWhitespaceMatch[0];
    if (
      commonWhitespace === null ||
      leadingWhitespace.length < commonWhitespace.length
    ) {
      commonWhitespace = leadingWhitespace;
    }
  }

  let outputText = "";
  if (commonWhitespace) {
    for (const line of lines) {
      outputText += line.slice(commonWhitespace!.length) + "\n";
    }
  } else {
    outputText = text;
  }

  return outputText.replace(/^\s*/, "").replace(/\s*$/, "");
}

export function elementCodeContent(element: HTMLElement): string {
  // innerText ignores ShadowDOM content
  // innerText ignores content that is visually hidden, textContent includes it
  // innerText doesn't include textarea text
  // textContent does
  // this way we get best of both worlds

  let code = stripWhitespace(element.innerText);
  if (code.length == 0) {
    code = stripWhitespace(element.textContent || "");
  }
  return code;
}

export function cmExtensions(syntax: Syntax) {
  switch (syntax) {
    case "python":
      return [python()];
    case "js":
      return [javascript()];
    case "sql":
      return [sql()];
    case "cpp":
      return [cpp()];
    case "html":
      return [html()];
    default:
      return [];
  }
}

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

export const cmHighlightStyle = HighlightStyle.define([
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
