// @ts-ignore - No type definitions
import untar from "js-untar";
// @ts-ignore - No type definitions
import { inflate } from "pako/dist/pako_inflate.min.js";

type TarFile = {
  name: string;
  type: string | number;
  buffer: ArrayBuffer;
  blob: Blob;
};

/**
 * Extract a .tar.gz file.
 *
 * Prefers ustar format.
 *
 * @param binary .tar.gz file
 * @returns
 */
export const extractTarGz = async (binary: Uint8Array): Promise<File[]> => {
  let files: File[] = [];

  // If we receive a tar.gz, we first need to uncompress it.
  let inflatedBinary: Uint8Array;
  try {
    inflatedBinary = inflate(binary);
  } catch (e) {
    inflatedBinary = binary;
  }

  try {
    files = (await untar(inflatedBinary.buffer))
      .filter((file: TarFile) => {
        return file.type === "file" || file.type === "0" || file.type == 0;
      })
      .map((file: TarFile) => {
        // HACK: Make all files start with / to solve compatibility issues
        const name = file.name.replace(/^([^/])/, "/$1");
        return new File([file.blob], name, {
          lastModified: Date.now(),
        });
      });
  } catch (e) {
    console.log("failed untar", e);
  }

  return files;
};
