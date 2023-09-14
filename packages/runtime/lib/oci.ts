import { BinaryWASIFS, BinaryWASIFile } from "@runno/wasi";
import { extractTarGz } from "./tar";

type OCIContext = {
  fs: BinaryWASIFS;
  entrypoint: string;
  env: Record<string, string>;
  args: string[];
};

export async function extractOCIFile(binary: Uint8Array): Promise<OCIContext> {
  const contents = await extractTarGz(binary);

  // TODO: throw if the file doesn't exist or whatever
  const manifestFile = contents["/manifest.json"];
  const manifest = fileToJSON(manifestFile);

  // TODO: throw if the file doesn't exist or whatever
  const configPath = manifest["Config"];
  const config = fileToJSON(contents[`/${configPath}`]);
  const entrypoint: string[] = config["config"]["Entrypoint"];
  const env = Object.fromEntries(
    config["config"]["Env"].map((s: string) => s.split("="))
  );

  const layerPaths: string[] = manifest["Layers"];
  const layers = await Promise.all(
    layerPaths.map((layerPath) => {
      const layerFile = contents[`/${layerPath}`];
      const layerFS = extractTarGz(layerFile.content);
      return layerFS;
    })
  );

  // TODO: Implement the OCI spec for layering
  // https://github.com/opencontainers/image-spec/blob/main/layer.md
  const fs = layers.reduce((prev, current) => ({ ...prev, ...current }), {});

  return {
    fs,
    env,
    entrypoint: entrypoint[0],
    args: entrypoint.slice(1, entrypoint.length),
  };
}

function fileToJSON(file: BinaryWASIFile): any {
  const decoder = new TextDecoder("utf-8");
  const text = decoder.decode(file.content);
  return JSON.parse(text);
}
