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
