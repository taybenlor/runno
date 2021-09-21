import { BigIntPolyfillType } from "./polyfills/bigint";
import { WASI_FILETYPE } from "./constants";

export interface Rights {
  base: BigIntPolyfillType;
  inheriting: BigIntPolyfillType;
}

export interface File {
  real: number;
  offset?: bigint;
  filetype?: WASI_FILETYPE;
  rights: Rights;
  path?: any;
  fakePath?: any;
}

export type Exports = {
  [key: string]: any;
};

// TODO: Remove? Unused
// type TypedArray = ArrayLike<any> & {
//   BYTES_PER_ELEMENT: number;
//   set(array: ArrayLike<number>, offset?: number): void;
//   slice(start?: number, end?: number): TypedArray;
// };

export type WASIBindings = {
  // Current high-resolution real time in a bigint
  hrtime: () => bigint;
  // Process functions
  exit: (rval: number) => void;
  kill: (signal: string) => void;
  // Crypto functions
  randomFillSync: <T>(buffer: T, offset: number, size: number) => T;
  // isTTY
  isTTY: (fd: number) => boolean;

  // Filesystem
  fs: any;

  // Path
  path: any;
};

export type WASIArgs = string[];
export type WASIEnv = { [key: string]: string | undefined };
export type WASIPreopenedDirs = { [key: string]: string };
export type WASIConfigOld = {
  // preopenDirectories is deprecated in favour of preopens
  preopenDirectories?: WASIPreopenedDirs;
  env?: WASIEnv;
  args?: WASIArgs;
  bindings?: WASIBindings;
};
export type WASIConfig = {
  preopens?: WASIPreopenedDirs;
  env?: WASIEnv;
  args?: WASIArgs;
  bindings?: WASIBindings;
};
