# @runno/component

A WebAssembly **Component Model** runtime for browsers and other
JavaScript runtimes, written in TypeScript.

Give it a component binary (WASI 0.2-style `.wasm` with the component
layer) and it runs it — no ahead-of-time transpilation, no build step,
no server. The component is decomposed at load time: the runtime parses
the component binary format, compiles the embedded core modules with the
browser's own `WebAssembly` API, evaluates the component's instantiation
and aliasing instructions, and bridges values across the canonical ABI.

```ts
import { instantiateComponent } from "@runno/component";

const bytes = await (await fetch("./calculator.wasm")).arrayBuffer();
const { exports } = await instantiateComponent(bytes, {
  // imports, keyed by the component's import names
  "docs:calculator/logger": { log: (msg) => console.log(msg) },
});

exports.add(1, 2); // 3
```

## Why

WASI 0.2 and everything after it is built on the Component Model, but
browsers only implement core WebAssembly. Existing tooling (jco)
_transpiles_ components to JS + core wasm ahead of time; that is a great
fit for bundlers, but it means components can't simply be loaded at
runtime the way core modules can. `@runno/component` is a _runtime_
host: any component can be fetched and executed dynamically, which is
what [Runno](https://runno.dev) needs to run arbitrary user-supplied
binaries in the browser.

## What works today

- **Full component binary format parser** (spec version 0x0d, including
  2026 additions: `map` types 🗺️, fixed-length lists 🔧, async built-in
  opcodes 🔀, name attributes 🏷️/🔗).
- **Linking & instantiation**: core module instantiation graphs, inline
  export instances, nested components, outer aliases, component
  imports/exports, cross-component function fusion.
- **Canonical ABI (sync)**: every value type — bools, all int widths,
  floats, chars, strings in all three encodings (`utf8`, `utf16`,
  `latin1+utf16` with spec-exact transcoding & realloc sequences),
  lists, records, tuples, flags, enums, options, results, variants
  (including flat-type join coercion), `map`, fixed-length lists —
  with parameter/result spilling, `realloc`/`post-return` contracts and
  trap semantics.
- **Resources**: guest-defined (handle tables, `resource.new/rep/drop`,
  destructors, own/borrow lend tracking) and host-defined (JS classes,
  jco-style `[constructor]`/`[method]`/`[static]` dispatch).
- **error-context** (📝) built-ins.
- **JS conventions compatible with jco**, so ecosystem shims like
  `@bytecodealliance/preview2-shim` can be used for WASI interfaces.

Conformance: the runtime passes 24 of the 26 top-level suites in
wasmtime's component-model wast testsuite (356 assertions) in Node,
Chromium, Firefox and WebKit. The remaining two (`exceptions`,
`memory64`) need core-wasm engine features that aren't enabled by
default in engines yet.

Not implemented yet: async (WASI 0.3 streams/futures/tasks 🔀),
memory64 pointers, the value section 🪙 (component-level value
imports/exports), and full link-time type-checking (the runtime trusts
`wasm-tools validate`-clean binaries).

## API

```ts
instantiateComponent(bytes, imports?, entityImports?)
  // -> Promise<{ exports, entity }>
parseComponent(bytes)      // -> ParsedComponent (AST + core module ranges)
isComponent(bytes)         // -> boolean (layer field check)
```

- Import names match the component's declared imports
  (`"wasi:cli/environment@0.2.0"`); the `@version` suffix may be
  omitted.
- Instance imports are plain objects: camelCase functions, PascalCase
  resource classes, nested objects for nested instances.
- `result<T, E>`-returning exports return `T` and throw
  `ComponentError` (with `.payload`) for the error case.
- `entity` / `entityImports` let you link one instantiated component
  into another without losing resource type identity.

Value conventions are documented in
[docs/canonical-abi.md](./docs/canonical-abi.md); the full spec notes
live in [docs/](./docs/README.md).

## Developing

```sh
npm run test:prepare   # build fixtures + fetch external suites
                       # (needs wasm-tools >= 1.245 and network access)
npm run test:unit      # Node unit + conformance tests
npm test               # Playwright: chromium, firefox, webkit
```

The `docs/` directory contains an implementer-oriented encoding of the
Component Model specification (binary format, canonical ABI, linking,
type system, async) — the runtime is written against those documents.
