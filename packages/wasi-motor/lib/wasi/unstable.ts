/**
 * The Whence enum in wasi_unstable has a different enum order.
 *
 * https://github.com/WebAssembly/WASI/blob/main/legacy/preview0/docs.md
 *
 * Wow that was a hard bug to track down.
 *
 */
export enum Whence {
  CUR = 0, // Seek relative to current position.
  END = 1, // Seek relative to end-of-file.
  SET = 2, // Seek relative to start-of-file.
}
