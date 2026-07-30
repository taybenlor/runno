// Node-side unit tests for WASIX's pure-logic helpers — the wasm
// import-section parser, memory/table override validation, and cwd path
// resolution. No browser, no guest binary: these run directly in the
// Playwright worker process.
//
// The parser tests hand-assemble minimal wasm binaries byte-by-byte so
// every branch (LEB128 widths, shared flag, memory64, unknown kinds,
// leading custom sections, malformed input) is exercised without a
// toolchain in the loop.

import { test, expect } from "@playwright/test";

import {
  parseEnvImportDescriptors,
  readVarUint32,
  validateMemoryOverride,
  validateTableOverride,
} from "../lib/wasix/module-imports";
import { resolveAbsolute, stripLeadingSlash } from "../lib/wasix/path-utils";

// ─── wasm binary assembly helpers ───────────────────────────────────────────

function leb(value: number): number[] {
  const out: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return out;
}

function name(str: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(str));
  return [...leb(bytes.length), ...bytes];
}

type ImportEntry = number[];

function memoryImport(
  mod: string,
  field: string,
  opts: { initial: number; maximum?: number; shared?: boolean },
): ImportEntry {
  let flags = 0;
  if (opts.maximum !== undefined) flags |= 0x01;
  if (opts.shared) flags |= 0x02;
  return [
    ...name(mod),
    ...name(field),
    0x02, // kind: memory
    flags,
    ...leb(opts.initial),
    ...(opts.maximum !== undefined ? leb(opts.maximum) : []),
  ];
}

function tableImport(
  mod: string,
  field: string,
  opts: { element?: number; initial: number; maximum?: number },
): ImportEntry {
  const flags = opts.maximum !== undefined ? 0x01 : 0x00;
  return [
    ...name(mod),
    ...name(field),
    0x01, // kind: table
    opts.element ?? 0x70, // funcref
    flags,
    ...leb(opts.initial),
    ...(opts.maximum !== undefined ? leb(opts.maximum) : []),
  ];
}

function functionImport(mod: string, field: string, typeIdx = 0): ImportEntry {
  return [...name(mod), ...name(field), 0x00, ...leb(typeIdx)];
}

function globalImport(mod: string, field: string): ImportEntry {
  // valtype i32 (0x7f), immutable (0x00)
  return [...name(mod), ...name(field), 0x03, 0x7f, 0x00];
}

function section(id: number, content: number[]): number[] {
  return [id, ...leb(content.length), ...content];
}

function moduleWithImports(
  entries: ImportEntry[],
  opts: { leadingCustomSection?: boolean } = {},
): Uint8Array {
  const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const custom = opts.leadingCustomSection
    ? section(0, [...name("meta"), 0x01, 0x02, 0x03])
    : [];
  const importContent = [...leb(entries.length), ...entries.flat()];
  return new Uint8Array([...header, ...custom, ...section(2, importContent)]);
}

// ─── parseEnvImportDescriptors ──────────────────────────────────────────────

test.describe("parseEnvImportDescriptors", () => {
  test("shared env.memory with limits", () => {
    const bytes = moduleWithImports([
      memoryImport("env", "memory", {
        initial: 17,
        maximum: 256,
        shared: true,
      }),
    ]);
    expect(parseEnvImportDescriptors(bytes)).toEqual({
      memory: { initial: 17, maximum: 256, shared: true },
    });
  });

  test("non-shared env.memory without maximum", () => {
    const bytes = moduleWithImports([
      memoryImport("env", "memory", { initial: 2 }),
    ]);
    expect(parseEnvImportDescriptors(bytes)).toEqual({
      memory: { initial: 2, maximum: undefined, shared: false },
    });
  });

  test("multi-byte LEB128 limits decode correctly", () => {
    const bytes = moduleWithImports([
      memoryImport("env", "memory", { initial: 300, maximum: 65536 }),
    ]);
    expect(parseEnvImportDescriptors(bytes)).toEqual({
      memory: { initial: 300, maximum: 65536, shared: false },
    });
  });

  test("env.__indirect_function_table descriptor", () => {
    const bytes = moduleWithImports([
      tableImport("env", "__indirect_function_table", {
        initial: 10,
        maximum: 100,
      }),
    ]);
    expect(parseEnvImportDescriptors(bytes)).toEqual({
      table: { element: "funcref", initial: 10, maximum: 100 },
    });
  });

  test("memory and table together, mixed with other imports", () => {
    const bytes = moduleWithImports([
      functionImport("wasix_32v1", "clock_time_get"),
      memoryImport("env", "memory", { initial: 4, shared: false }),
      globalImport("env", "__stack_pointer"),
      tableImport("env", "__indirect_function_table", { initial: 1 }),
      functionImport("wasi_snapshot_preview1", "fd_write", 3),
    ]);
    expect(parseEnvImportDescriptors(bytes)).toEqual({
      memory: { initial: 4, maximum: undefined, shared: false },
      table: { element: "funcref", initial: 1, maximum: undefined },
    });
  });

  test("non-env memory imports are ignored", () => {
    const bytes = moduleWithImports([
      memoryImport("other", "memory", { initial: 1 }),
    ]);
    expect(parseEnvImportDescriptors(bytes)).toEqual({});
  });

  test("function-only imports (preview1-style binary) yield no descriptors", () => {
    const bytes = moduleWithImports([
      functionImport("wasi_snapshot_preview1", "proc_exit"),
    ]);
    expect(parseEnvImportDescriptors(bytes)).toEqual({});
  });

  test("leading custom section is skipped", () => {
    const bytes = moduleWithImports(
      [memoryImport("env", "memory", { initial: 3, shared: false })],
      { leadingCustomSection: true },
    );
    expect(parseEnvImportDescriptors(bytes)).toEqual({
      memory: { initial: 3, maximum: undefined, shared: false },
    });
  });

  test("memory64 flag decodes limits as varuint64", () => {
    // flags 0x05 = has_max | memory64
    const entry = [
      ...name("env"),
      ...name("memory"),
      0x02,
      0x05,
      ...leb(5),
      ...leb(10),
    ];
    const bytes = moduleWithImports([entry]);
    expect(parseEnvImportDescriptors(bytes)).toEqual({
      memory: { initial: 5, maximum: 10, shared: false },
    });
  });

  test("bad magic returns empty result", () => {
    expect(parseEnvImportDescriptors(new Uint8Array([1, 2, 3, 4]))).toEqual({});
    const wrongMagic = moduleWithImports([
      memoryImport("env", "memory", { initial: 1 }),
    ]);
    wrongMagic[0] = 0xff;
    expect(parseEnvImportDescriptors(wrongMagic)).toEqual({});
  });

  test("unknown import kind bails without misaligned garbage", () => {
    const bogusKind = [...name("env"), ...name("weird"), 0x07, 0x00];
    const bytes = moduleWithImports([
      memoryImport("env", "memory", { initial: 6, shared: false }),
      bogusKind,
    ]);
    // The parser keeps whatever it decoded before the unknown kind and
    // stops — it must not throw or return misparsed descriptors.
    expect(parseEnvImportDescriptors(bytes)).toEqual({
      memory: { initial: 6, maximum: undefined, shared: false },
    });
  });

  test("readVarUint32 throws on over-long encoding", () => {
    expect(() =>
      readVarUint32(
        new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01]),
        0,
      ),
    ).toThrow(/malformed varuint32/);
  });
});

// ─── override validation ────────────────────────────────────────────────────

test.describe("validateMemoryOverride", () => {
  test("accepts a matching non-shared memory", () => {
    const memory = new WebAssembly.Memory({ initial: 2 });
    expect(() =>
      validateMemoryOverride(memory, { initial: 2, shared: false }),
    ).not.toThrow();
  });

  test("accepts a matching shared memory", () => {
    const memory = new WebAssembly.Memory({
      initial: 1,
      maximum: 4,
      shared: true,
    });
    expect(() =>
      validateMemoryOverride(memory, { initial: 1, maximum: 4, shared: true }),
    ).not.toThrow();
  });

  test("rejects shared-flag mismatch in both directions", () => {
    const plain = new WebAssembly.Memory({ initial: 1 });
    expect(() =>
      validateMemoryOverride(plain, { initial: 1, shared: true }),
    ).toThrow(/shared/);

    const shared = new WebAssembly.Memory({
      initial: 1,
      maximum: 2,
      shared: true,
    });
    expect(() =>
      validateMemoryOverride(shared, { initial: 1, shared: false }),
    ).toThrow(/shared/);
  });

  test("rejects a memory smaller than the declared initial", () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    expect(() =>
      validateMemoryOverride(memory, { initial: 2, shared: false }),
    ).toThrow(/initial=2/);
  });
});

test.describe("validateTableOverride", () => {
  test("accepts a table at least as large as the declared initial", () => {
    const table = new WebAssembly.Table({ element: "anyfunc", initial: 5 });
    expect(() =>
      validateTableOverride(table, { element: "funcref", initial: 5 }),
    ).not.toThrow();
  });

  test("rejects a table smaller than the declared initial", () => {
    const table = new WebAssembly.Table({ element: "anyfunc", initial: 1 });
    expect(() =>
      validateTableOverride(table, { element: "funcref", initial: 3 }),
    ).toThrow(/initial=3/);
  });
});

// ─── path resolution ────────────────────────────────────────────────────────

test.describe("resolveAbsolute", () => {
  test("joins relative paths against the cwd", () => {
    expect(resolveAbsolute("/home", "foo")).toBe("/home/foo");
    expect(resolveAbsolute("/home", "foo/bar")).toBe("/home/foo/bar");
  });

  test("absolute paths bypass the cwd", () => {
    expect(resolveAbsolute("/home", "/data/x")).toBe("/data/x");
  });

  test("folds . and .. segments", () => {
    expect(resolveAbsolute("/home/a", "../b")).toBe("/home/b");
    expect(resolveAbsolute("/home", "./foo/./bar")).toBe("/home/foo/bar");
    expect(resolveAbsolute("/home/a/b", "../../c")).toBe("/home/c");
  });

  test("clamps .. at the root instead of escaping", () => {
    expect(resolveAbsolute("/", "../../x")).toBe("/x");
    expect(resolveAbsolute("/home", "../../../..")).toBe("/");
  });

  test("normalises trailing and duplicate slashes", () => {
    expect(resolveAbsolute("/home", "foo/")).toBe("/home/foo");
    expect(resolveAbsolute("/home", "foo//bar")).toBe("/home/foo/bar");
    expect(resolveAbsolute("/", ".")).toBe("/");
  });
});

test.describe("stripLeadingSlash", () => {
  test("strips exactly one leading slash", () => {
    expect(stripLeadingSlash("/home/foo")).toBe("home/foo");
    expect(stripLeadingSlash("home/foo")).toBe("home/foo");
  });
});
