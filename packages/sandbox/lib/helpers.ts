import { extractTarGz } from "./tar.ts";

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

/**
 * Fetches and deflates a .tar.gz file representing a base filesystem.
 * This is for languages that require specific files to already exist.
 *
 * Prefers .tar.gz files in ustar format.
 *
 * @param fsURL The URL of the filesystem to fetch
 */
export async function fetchWASIFS(fsURL: string) {
  const response = await fetch(fsURL);
  const buffer = await response.arrayBuffer();
  return await extractTarGz(new Uint8Array(buffer));
}

export function isErrorObject(
  e: unknown
): e is { type: string; message: string } {
  return (
    e != null &&
    typeof e === "object" &&
    "message" in e &&
    typeof e["message"] === "string" &&
    "type" in e &&
    typeof e["type"] === "string"
  );
}

export function makeRunnoError(e: unknown): { type: string; message: string } {
  if (e instanceof Error) {
    return {
      message: e.message,
      type: e.constructor.name,
    };
  } else if (isErrorObject(e)) {
    return e;
  } else {
    return {
      message: `unknown error - ${e}`,
      type: "Unknown",
    };
  }
}

export function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  } else if (isErrorObject(e)) {
    return e.message;
  } else {
    return "Unknown error";
  }
}

export function assertUnreachable(_: never, message?: string): never {
  throw new Error(message ?? "Unexpectedly reached unreachable code.");
}
