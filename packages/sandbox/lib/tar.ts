import type { BinaryWASIFS } from "@runno/wasi";
import { UntarStream } from "@std/tar/untar-stream";

/**
 * Extract a .tar.gz file.
 *
 * Only works for ustar format.
 *
 * @param binary .tar.gz file
 * @returns
 */
export const extractTarGz = async (
  binary: Uint8Array
): Promise<BinaryWASIFS> => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(binary);
      controller.close();
    },
  });

  const fs: BinaryWASIFS = {};
  for await (const entry of stream
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new UntarStream())) {
    if (!entry.readable) {
      continue;
    }

    const content = streamToUint8Array(entry.readable);

    // HACK: Make sure each file name starts with /
    const name = entry.path.replace(/^([^/])/, "/$1");
    fs[name] = {
      path: name,
      timestamps: {
        change: new Date(entry.header.mtime * 1000),
        access: new Date(entry.header.mtime * 1000),
        modification: new Date(entry.header.mtime * 1000),
      },
      mode: "binary",
      content: await content,
    };
  }

  return fs;
};

async function streamToUint8Array(
  readableStream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = readableStream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}
