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

export const extractTarGz = async (binary: Uint8Array): Promise<File[]> => {
  const files: File[] = [];

  // We receive a tar.gz, we first need to uncompress it.
  const inflatedBinary = inflate(binary);
  await untar(inflatedBinary.buffer).progress(function (file: TarFile) {
    if (file.type === "file" || file.type === "0" || file.type == 0) {
      files.push(
        new File([file.blob], file.name, {
          lastModified: Date.now(),
        })
      );
    }
  });

  return files;
};
