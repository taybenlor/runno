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
  let files: File[] = [];

  // We receive a tar.gz, we first need to uncompress it.
  const inflatedBinary: Uint8Array = inflate(binary);
  try {
    files = (await untar(inflatedBinary.buffer))
      .filter((file: TarFile) => {
        return file.type === "file" || file.type === "0" || file.type == 0;
      })
      .map((file: TarFile) => {
        // HACK: Make all files start with / to solve compatibility issues
        // TODO: Perhaps switch this over to "sysroot/foo" => "/foo"
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
