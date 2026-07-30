(component
  (core module $m
    (memory (export "memory") 1)
    (global $next (mut i32) (i32.const 64))
    (func $realloc (export "realloc") (param i32 i32 i32 i32) (result i32)
      (local $ptr i32)
      global.get $next
      local.get 2
      i32.const 1
      i32.sub
      i32.add
      local.get 2
      i32.const 1
      i32.sub
      i32.const -1
      i32.xor
      i32.and
      local.set $ptr
      local.get $ptr
      local.get 3
      i32.add
      global.set $next
      local.get $ptr)
    (data (i32.const 16) "Hello, ")
    (func $greet (export "greet") (param $ptr i32) (param $len i32) (result i32)
      (local $buf i32) (local $ret i32)
      (local.set $buf
        (call $realloc (i32.const 0) (i32.const 0) (i32.const 1)
          (i32.add (i32.const 7) (local.get $len))))
      (memory.copy (local.get $buf) (i32.const 16) (i32.const 7))
      (memory.copy (i32.add (local.get $buf) (i32.const 7))
        (local.get $ptr) (local.get $len))
      (local.set $ret
        (call $realloc (i32.const 0) (i32.const 0) (i32.const 4) (i32.const 8)))
      (i32.store (local.get $ret) (local.get $buf))
      (i32.store offset=4 (local.get $ret)
        (i32.add (i32.const 7) (local.get $len)))
      local.get $ret))
  (core instance $i (instantiate $m))
  (alias core export $i "memory" (core memory $mem))
  (alias core export $i "realloc" (core func $realloc))
  (func (export "greet") (param "name" string) (result string)
    (canon lift (core func $i "greet") (memory $mem) (realloc $realloc))))
