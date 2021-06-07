import WasmFs from "./index";
// @ts-ignore
import untar from "js-untar";
// @ts-ignore
import { inflate } from "pako/dist/pako_inflate.min.js";
import { Buffer } from "buffer";

export const dirname = (path: string) => {
  return path.replace(/\\/g, "/").replace(/\/[^\/]*$/, "");
};

type TarFile = {
  name: string;
  type: string | number;
  buffer: ArrayBuffer;
  blob: Blob;
};

export const extractContents = (
  wasmFs: WasmFs,
  binary: Uint8Array,
  to: string
): Promise<any> => {
  const volume = wasmFs.volume;
  // We create the "to" directory, in case it doesn't exist
  (volume as any).mkdirpBase(to, 0o777);
  // We receive a tar.gz, we first need to uncompress it.
  const inflatedBinary = inflate(binary);
  return untar(inflatedBinary.buffer).progress(function (file: TarFile) {
    const fullname = `${to}/${file.name}`;
    const contents = Buffer.from(file.buffer);
    if (file.type === "file" || file.type === "0" || file.type == 0) {
      try {
        volume.writeFileSync(fullname, contents);
      } catch (e) {
        // The directory is not created yet
        let dir = dirname(fullname);
        (volume as any).mkdirpBase(dir, 0o777);
        volume.writeFileSync(fullname, contents);
      }
    } else if (
      file.type === "directory" ||
      file.type === "5" ||
      file.type == 5
    ) {
      (volume as any).mkdirpBase(fullname, 0o777);
    }
  });
};
