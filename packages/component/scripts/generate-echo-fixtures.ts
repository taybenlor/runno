/**
 * Generates "echo" component fixtures: each component imports a host
 * function `echo: func(v: T) -> T` and exports `run: func(v: T) -> T`
 * whose core implementation forwards to the import. Calling `run` from JS
 * exercises the full canonical ABI in all four directions:
 *
 *   JS args --lower--> core --lift--> host echo --lower--> core --lift--> JS
 *
 * The core plumbing only depends on the flattened shape of T, so it can
 * be generated for any type.
 *
 * Usage: node --experimental-strip-types scripts/generate-echo-fixtures.ts
 * Requires wasm-tools on PATH (or WASM_TOOLS env var).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  alignment,
  elemSize,
  flattenType,
  MAX_FLAT_PARAMS,
  MAX_FLAT_RESULTS,
  type RT,
} from "../lib/runtime/types.ts";

interface EchoCase {
  name: string;
  /**
   * WAT text of the component-level type, or a $ref to a named type.
   * Named types (record/variant/flags/enum) must be listed in `named` —
   * boundary signatures may only use them via imported/exported type
   * indices (the WIT round-trip rule wasm-tools enforces).
   */
  wat: string;
  rt: RT;
  named?: { name: string; wat: string }[];
}

const flagLabels = (n: number) => Array.from({ length: n }, (_, i) => `f${i}`);

const CASES: EchoCase[] = [
  { name: "bool", wat: "bool", rt: { k: "bool" } },
  { name: "u8", wat: "u8", rt: { k: "u8" } },
  { name: "s8", wat: "s8", rt: { k: "s8" } },
  { name: "u16", wat: "u16", rt: { k: "u16" } },
  { name: "s16", wat: "s16", rt: { k: "s16" } },
  { name: "u32", wat: "u32", rt: { k: "u32" } },
  { name: "s32", wat: "s32", rt: { k: "s32" } },
  { name: "u64", wat: "u64", rt: { k: "u64" } },
  { name: "s64", wat: "s64", rt: { k: "s64" } },
  { name: "f32", wat: "f32", rt: { k: "f32" } },
  { name: "f64", wat: "f64", rt: { k: "f64" } },
  { name: "char", wat: "char", rt: { k: "char" } },
  { name: "string", wat: "string", rt: { k: "string" } },
  {
    name: "list-u8",
    wat: "(list u8)",
    rt: { k: "list", element: { k: "u8" } },
  },
  {
    name: "list-u32",
    wat: "(list u32)",
    rt: { k: "list", element: { k: "u32" } },
  },
  {
    name: "list-string",
    wat: "(list string)",
    rt: { k: "list", element: { k: "string" } },
  },
  {
    name: "record",
    wat: "$rec",
    named: [
      {
        name: "rec",
        wat: `(record (field "count" u32) (field "label-text" string) (field "ratio" f64))`,
      },
    ],
    rt: {
      k: "record",
      fields: [
        { label: "count", camel: "count", type: { k: "u32" } },
        { label: "label-text", camel: "labelText", type: { k: "string" } },
        { label: "ratio", camel: "ratio", type: { k: "f64" } },
      ],
    },
  },
  {
    name: "tuple",
    wat: "(tuple u32 u64 string)",
    rt: {
      k: "tuple",
      elements: [{ k: "u32" }, { k: "u64" }, { k: "string" }],
    },
  },
  {
    name: "flags3",
    wat: "$fl",
    named: [{ name: "fl", wat: `(flags "f0" "f1" "f2")` }],
    rt: { k: "flags", labels: flagLabels(3), camels: flagLabels(3) },
  },
  {
    name: "flags17",
    wat: "$fl",
    named: [
      {
        name: "fl",
        wat: `(flags ${flagLabels(17)
          .map((l) => `"${l}"`)
          .join(" ")})`,
      },
    ],
    rt: { k: "flags", labels: flagLabels(17), camels: flagLabels(17) },
  },
  {
    name: "enum",
    wat: "$en",
    named: [{ name: "en", wat: `(enum "red" "green" "blue")` }],
    rt: { k: "enum", labels: ["red", "green", "blue"] },
  },
  {
    name: "option-u32",
    wat: "(option u32)",
    rt: { k: "option", type: { k: "u32" } },
  },
  {
    name: "option-string",
    wat: "(option string)",
    rt: { k: "option", type: { k: "string" } },
  },
  {
    name: "option-option-u8",
    wat: "(option (option u8))",
    rt: { k: "option", type: { k: "option", type: { k: "u8" } } },
  },
  {
    name: "result-u32-string",
    wat: "(result u32 (error string))",
    rt: { k: "result", ok: { k: "u32" }, error: { k: "string" } },
  },
  {
    name: "variant-join-i64",
    wat: "$var",
    named: [
      {
        name: "var",
        wat: `(variant (case "empty") (case "num" u32) (case "text" string) (case "big" f64))`,
      },
    ],
    rt: {
      k: "variant",
      cases: [
        { label: "empty" },
        { label: "num", type: { k: "u32" } },
        { label: "text", type: { k: "string" } },
        { label: "big", type: { k: "f64" } },
      ],
    },
  },
  {
    name: "variant-join-f32",
    wat: "$var",
    named: [
      {
        name: "var",
        wat: `(variant (case "ratio" f32) (case "count" u32))`,
      },
    ],
    rt: {
      k: "variant",
      cases: [
        { label: "ratio", type: { k: "f32" } },
        { label: "count", type: { k: "u32" } },
      ],
    },
  },
  {
    name: "big-tuple",
    // 9 strings = 18 flat values: spills both params and results.
    wat: `(tuple ${Array(9).fill("string").join(" ")})`,
    rt: {
      k: "tuple",
      elements: Array(9).fill({ k: "string" }),
    },
  },
  {
    name: "nested",
    wat: "(list $item)",
    named: [
      { name: "kind", wat: `(variant (case "a") (case "b" s32))` },
      {
        name: "item",
        wat: `(record (field "id" u64) (field "tags" (list string)) (field "kind" $kind))`,
      },
    ],
    rt: {
      k: "list",
      element: {
        k: "record",
        fields: [
          { label: "id", camel: "id", type: { k: "u64" } },
          {
            label: "tags",
            camel: "tags",
            type: { k: "list", element: { k: "string" } },
          },
          {
            label: "kind",
            camel: "kind",
            type: {
              k: "variant",
              cases: [{ label: "a" }, { label: "b", type: { k: "s32" } }],
            },
          },
        ],
      },
    },
  },
];

const LIBC = `
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
`;

function coreParams(flat: string[]): string {
  return flat.length === 0 ? "" : ` (param ${flat.join(" ")})`;
}

function coreResults(flat: string[]): string {
  return flat.length === 0 ? "" : ` (result ${flat.join(" ")})`;
}

function generate(testCase: EchoCase): string {
  const flat = flattenType(testCase.rt);
  const spillParams = flat.length > MAX_FLAT_PARAMS;
  const spillResults = flat.length > MAX_FLAT_RESULTS;

  const liftParams = spillParams ? ["i32"] : flat;
  // canon lift with spilled results: core returns a pointer.
  const liftResults = spillResults ? ["i32"] : flat;
  // canon lower with spilled results: core passes a retptr param.
  const lowerParams = spillParams
    ? ["i32", ...(spillResults ? ["i32"] : [])]
    : [...flat, ...(spillResults ? ["i32"] : [])];
  const lowerResults = spillResults ? [] : flat;

  const forwards = liftParams.map((_, i) => `      local.get ${i}`).join("\n");

  let body: string;
  if (spillResults) {
    const align = alignment(testCase.rt);
    const size = elemSize(testCase.rt);
    body = `
    (func (export "run")${coreParams(liftParams)} (result i32)
      (local $ret i32)
      (local.set $ret
        (call $realloc (i32.const 0) (i32.const 0)
          (i32.const ${align}) (i32.const ${size})))
${forwards}
      local.get $ret
      call $echo
      local.get $ret)`;
  } else {
    body = `
    (func (export "run")${coreParams(liftParams)}${coreResults(liftResults)}
${forwards}
      call $echo)`;
  }

  const namedDefs = (testCase.named ?? [])
    .map(
      (n) =>
        `  (type $${n.name}-def ${n.wat})\n` +
        `  (import "type-${n.name}" (type $${n.name} (eq $${n.name}-def)))\n`,
    )
    .join("");
  const needsType = testCase.wat.startsWith("(");
  const typeDef = needsType ? `  (type $t ${testCase.wat})\n` : "";
  const typeRef = needsType ? "$t" : testCase.wat; // prim name or $ref to a named import

  return `(component
${namedDefs}${typeDef}  (import "echo" (func $echo (param "v" ${typeRef}) (result ${typeRef})))
${LIBC}
  (core instance $libc (instantiate $libc))
  (alias core export $libc "memory" (core memory $mem))
  (alias core export $libc "realloc" (core func $realloc))
  (core func $echo-lowered
    (canon lower (func $echo) (memory $mem) (realloc $realloc)))
  (core module $m
    (import "env" "echo"
      (func $echo${coreParams(lowerParams)}${coreResults(lowerResults)}))
    (import "env" "realloc" (func $realloc (param i32 i32 i32 i32) (result i32)))
${body})
  (core instance $env
    (export "echo" (func $echo-lowered))
    (export "realloc" (func $realloc)))
  (core instance $i (instantiate $m (with "env" (instance $env))))
  (func (export "run") (param "v" ${typeRef}) (result ${typeRef})
    (canon lift (core func $i "run") (memory $mem) (realloc $realloc)))
)
`;
}

const root = fileURLToPath(new URL("..", import.meta.url));
const watDir = `${root}tests/fixtures/wat/echo`;
const outDir = `${root}tests/fixtures/echo`;
mkdirSync(watDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const wasmTools = process.env.WASM_TOOLS ?? "wasm-tools";
const manifest: string[] = [];

for (const testCase of CASES) {
  const wat = generate(testCase);
  const watPath = `${watDir}/${testCase.name}.wat`;
  const wasmPath = `${outDir}/${testCase.name}.wasm`;
  writeFileSync(watPath, wat);
  execFileSync(wasmTools, ["parse", watPath, "-o", wasmPath]);
  execFileSync(wasmTools, ["validate", wasmPath]);
  manifest.push(testCase.name);
  console.log(`built echo/${testCase.name}.wasm`);
}

writeFileSync(
  `${outDir}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`${manifest.length} echo fixtures built`);
