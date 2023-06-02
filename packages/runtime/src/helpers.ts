import { WASIFS } from "@runno/wasi-motor";
import { extractTarGz } from "./tar";

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

/**
 * Fetches and deflates a .tar.gz file representing a base filesystem.
 * This is for languages that require specific files to already exist.
 *
 * Prefers .tar.gz files in ustar format.
 *
 * @param fsURL The URL of the filesystem to fetch
 */
export async function fetchWASIFS(fsURL: `${string}.tar.gz`) {
  const response = await fetch(fsURL);
  const buffer = await response.arrayBuffer();
  const files = await extractTarGz(new Uint8Array(buffer));

  const fs: WASIFS = {};
  for (const file of files) {
    fs[file.name] = {
      path: file.name,
      timestamps: {
        change: new Date(file.lastModified),
        access: new Date(file.lastModified),
        modification: new Date(file.lastModified),
      },
      mode: "binary",
      content: new Uint8Array(await file.arrayBuffer()),
    };
  }

  return fs;
}
