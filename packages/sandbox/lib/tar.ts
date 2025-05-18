import type { BinaryWASIFS } from "@runno/wasi";
import * as tar from "tar";
import { Readable } from "node:stream";
import { gunzipSync } from "zlib";

/**
 * Extract a .tar.gz file.
 *
 * @param binary .tar.gz file
 * @returns
 */
export const extractTarGz = async (
  binary: Uint8Array
): Promise<BinaryWASIFS> => {
  const fs: BinaryWASIFS = {};

  return new Promise((resolve, reject) => {
    // Create a readable stream from the binary data
    const stream = Readable.from(gunzipSync(binary));

    let entriesCompleted = 0;
    let entriesStarted = 0;
    let finished = false;

    const checkIfComplete = () => {
      if (finished && entriesCompleted === entriesStarted) {
        resolve(fs);
      }
    };

    const extraction = stream.pipe(
      tar.t({
        onwarn: (message) => {
          console.warn(`Tar extraction warning: ${message}`);
        },
        onentry: (entry) => {
          entriesStarted++;

          if (entry.type !== "File") {
            // Skip non-file entries (directories, symlinks, etc.)
            entry.resume();
            entriesCompleted++;
            checkIfComplete();
            return;
          }

          // Make sure each file name starts with /
          const name = entry.path.replace(/^([^/])/, "/$1");

          const collectedData: Buffer[] = [];

          entry.on("data", (data) => {
            collectedData.push(data);
          });

          entry.on("end", () => {
            // Add the file to our filesystem object
            fs[name] = {
              path: name,
              timestamps: {
                change: entry.header.mtime
                  ? new Date(entry.header.mtime.getTime())
                  : new Date(),
                access: entry.header.atime
                  ? new Date(entry.header.atime.getTime())
                  : new Date(),
                modification: entry.header.mtime
                  ? new Date(entry.header.mtime.getTime())
                  : new Date(),
              },
              mode: "binary",
              content: new Uint8Array(Buffer.concat(collectedData)),
            };

            entriesCompleted++;
            checkIfComplete();
          });

          entry.on("error", (err) => {
            reject(new Error(`Error processing entry ${name}: ${err}`));
          });
        },
      })
    );

    // Handle successful completion
    extraction.on("end", () => {
      finished = true;
      checkIfComplete();
    });

    // Handle errors in the extraction pipeline
    extraction.on("error", (err) => {
      reject(new Error(`Tar extraction error: ${err}`));
    });

    // Handle errors in the input stream
    stream.on("error", (err) => {
      reject(new Error(`Stream error during tar extraction: ${err}`));
    });

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      stream.destroy();
      reject(new Error("Tar extraction timed out after 60 seconds"));
    }, 60000);

    // Clear the timeout when done
    extraction.on("end", () => {
      clearTimeout(timeout);
    });

    extraction.on("error", () => {
      clearTimeout(timeout);
    });
  });
};
