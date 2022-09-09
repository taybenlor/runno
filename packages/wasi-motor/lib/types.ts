export type WASIPath = string;

export type WASIFS = {
  [path: WASIPath]: WASIFile;
};

export type WASITimestamps = {
  access: Date;
  modification: Date;
  change: Date;
};

export type WASIFile = {
  path: WASIPath; // TODO: This duplication is annoying, lets remove it
  timestamps: WASITimestamps;
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

export type WASIExecutionResult = {
  exitCode: number;
  fs: WASIFS;
};
