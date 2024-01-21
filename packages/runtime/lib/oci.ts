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

  const manifestFile = contents["/manifest.json"];
  const manifest = fileToJSON(manifestFile)[0];

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

  // OCI spec for layering includes whiteout / deleting files
  // https://github.com/opencontainers/image-spec/blob/main/layer.md
  const fs = layers.reduce((prev, current) => {
    // Whiteout files must be applied first

    const entries = Object.entries(current);
    for (const [path] of entries) {
      if (path.endsWith(".wh..wh..opq")) {
        // Opaque whiteout, delete all siblings
        const prefix = path.replace(".wh..wh..opq", "");
        for (const [existingPath] of Object.entries(prev)) {
          if (existingPath.startsWith(prefix)) {
            delete prev[existingPath];
          }
        }
      } else if (path.includes(".wh.")) {
        // Regular whiteout - just delete this one file
        const filename = path.replace(".wh.", "");
        delete prev[filename];
      }
    }

    const currentWithoutWhiteouts = Object.fromEntries(
      entries.filter(([p]) => !p.includes(".wh."))
    );

    return { ...prev, ...currentWithoutWhiteouts };
  }, {});

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
