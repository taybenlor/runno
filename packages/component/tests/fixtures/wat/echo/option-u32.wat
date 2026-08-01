(component
  (type $t (option u32))
  (import "echo" (func $echo (param "v" $t) (result $t)))

  (core module $libc
    (memory (export "memory") 1 256)
    (global $next (mut i32) (i32.const 64))
    (func (export "realloc") (param i32 i32 i32 i32) (result i32)
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
      (if (i32.gt_u
            (i32.add (local.get $ptr) (local.get 3))
            (i32.mul (memory.size) (i32.const 65536)))
        (then
          (drop (memory.grow
            (i32.add
              (i32.div_u
                (i32.sub
                  (i32.add (local.get $ptr) (local.get 3))
                  (i32.mul (memory.size) (i32.const 65536)))
                (i32.const 65536))
              (i32.const 1))))))
      local.get $ptr
      local.get 3
      i32.add
      global.set $next
      (if (i32.ne (local.get 0) (i32.const 0))
        (then
          (memory.copy
            (local.get $ptr)
            (local.get 0)
            (select (local.get 1) (local.get 3)
              (i32.lt_u (local.get 1) (local.get 3))))))
      local.get $ptr))

  (core instance $libc (instantiate $libc))
  (alias core export $libc "memory" (core memory $mem))
  (alias core export $libc "realloc" (core func $realloc))
  (core func $echo-lowered
    (canon lower (func $echo) (memory $mem) (realloc $realloc)))
  (core module $m
    (import "env" "echo"
      (func $echo (param i32 i32 i32)))
    (import "env" "realloc" (func $realloc (param i32 i32 i32 i32) (result i32)))

    (func (export "run") (param i32 i32) (result i32)
      (local $ret i32)
      (local.set $ret
        (call $realloc (i32.const 0) (i32.const 0)
          (i32.const 4) (i32.const 8)))
      local.get 0
      local.get 1
      local.get $ret
      call $echo
      local.get $ret))
  (core instance $env
    (export "echo" (func $echo-lowered))
    (export "realloc" (func $realloc)))
  (core instance $i (instantiate $m (with "env" (instance $env))))
  (func (export "run") (param "v" $t) (result $t)
    (canon lift (core func $i "run") (memory $mem) (realloc $realloc)))
)
