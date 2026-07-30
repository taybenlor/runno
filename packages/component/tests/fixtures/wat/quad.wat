(component
  (import "double" (func $double (param "x" u32) (result u32)))
  (core func $double-lowered (canon lower (func $double)))
  (core module $m
    (import "env" "double" (func $d (param i32) (result i32)))
    (func (export "quad") (param i32) (result i32)
      local.get 0
      call $d
      call $d))
  (core instance $shim (export "double" (func $double-lowered)))
  (core instance $i (instantiate $m (with "env" (instance $shim))))
  (func (export "quad") (param "x" u32) (result u32)
    (canon lift (core func $i "quad"))))
