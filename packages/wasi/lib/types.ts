export type WASIPath = string;

export type WASIFS = {
  [path: WASIPath]: WASIFile;
};

export type BinaryWASIFS = {
  [path: WASIPath]: BinaryWASIFile;
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

export type BinaryWASIFile = {
  path: WASIPath;
  timestamps: WASITimestamps;
  mode: "binary";
  content: Uint8Array;
};

export type WASIExecutionResult = {
  exitCode: number;
  fs: WASIFS;
};

export type WASMArg = Int32 | Uint32 | string | Int32Array | Uint32Array;

export class Int32 {
  private _value: number = 0;
  constructor(newValue: number) {
    if (newValue < -2147483648 || 2147483647 < newValue) {
      throw new TypeError("Number doesn't fit within range!");
    }
    this._value = newValue;
  }
  get value(): number {
    return this._value;
  }
  set value(newValue: number) {
    if (newValue < -2147483648 || 2147483647 < newValue) {
      throw new TypeError("Number doesn't fit within range!");
    }
    this._value = newValue;
  }
}

export class Uint32 {
  private _value: number = 0;
  constructor(newValue: number) {
    if (newValue < 0 || 4294967295 < newValue) {
      throw new TypeError("Number doesn't fit within range!");
    }
    this._value = newValue;
  }
  get value(): number {
    return this._value;
  }
  set value(newValue: number) {
    if (newValue < 0 || 4294967295 < newValue) {
      throw new TypeError("Number doesn't fit within range!");
    }
    this._value = newValue;
  }
}
