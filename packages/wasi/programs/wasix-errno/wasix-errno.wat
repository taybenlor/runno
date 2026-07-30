;; Error-model probe: calls wasix_32v1 random_get and exits with the
;; returned errno as the process exit code. Lets the Playwright error-model
;; spec observe exactly which errno a throwing provider produced:
;;
;;   provider ok                          → exit 0
;;   provider throws WASIXError(result)   → exit <result>
;;   provider throws anything else        → exit EIO (29)
;;
;; Build: wat2wasm wasix-errno.wat -o wasix-errno.wasm

(module
  ;; random_get(buf: i32, buf_len: i32) -> i32 (errno)
  (import "wasix_32v1" "random_get"
    (func $random_get (param i32 i32) (result i32)))
  (import "wasi_snapshot_preview1" "proc_exit"
    (func $proc_exit (param i32)))

  (memory (;0;) 1)
  (export "memory" (memory 0))
  (export "_start" (func $start))

  (func $start
    i32.const 16  ;; buf
    i32.const 8   ;; buf_len
    call $random_get
    call $proc_exit))
