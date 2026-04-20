;; Hand-rolled WASIX hello-world smoke test.
;;
;; Imports only wasi_snapshot_preview1 (fd_write + proc_exit), which WASIX
;; delegates to its internal WASI instance. This slice stubs every wasix_32v1
;; import to ENOSYS, so the binary must exercise preview1 exclusively.
;;
;; Build:  wat2wasm wasix-hello.wat -o wasix-hello.wasm
;;
;; A Rust/cargo-wasix version will land in a later slice once the
;; wasix_32v1 surface is wired up to real providers.

(module
  (type (;0;) (func (param i32 i32 i32 i32) (result i32)))
  (type (;1;) (func (param i32)))
  (type (;2;) (func))
  (import "wasi_snapshot_preview1" "fd_write"  (func $fd_write  (type 0)))
  (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (type 1)))
  (memory (;0;) 1)
  (export "memory" (memory 0))
  (export "_start" (func $start))
  (func $start (type 2)
    ;; iov[0] at offset 0:
    ;;   iov[0].buf     = 8   (offset of the string)
    ;;   iov[0].buf_len = 13  (length of "hello, world\n")
    i32.const 0
    i32.const 8
    i32.store
    i32.const 4
    i32.const 13
    i32.store
    ;; fd_write(fd=1, iovs=0, iovs_len=1, nwritten_ptr=24) -> drop result
    i32.const 1
    i32.const 0
    i32.const 1
    i32.const 24
    call $fd_write
    drop
    ;; proc_exit(0)
    i32.const 0
    call $proc_exit)
  (data (i32.const 8) "hello, world\n")
)
