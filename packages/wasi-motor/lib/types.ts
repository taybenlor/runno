export type WASIPath = string;

export type WASIFS = {
  [path: WASIPath]: WASIFile;
};

export type WASIFile = {
  path: WASIPath;
} & (
  | {
      mode: "string";
      content: string;
    }
  | {
      mode: "binary";
      content: Uint8Array;
    }
);
