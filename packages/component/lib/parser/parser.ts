/**
 * Parser for the Component Model binary format.
 *
 * Follows design/mvp/Binary.md from WebAssembly/component-model. Core
 * modules are kept as byte ranges into the original buffer so they can be
 * passed directly to WebAssembly.compile without copying.
 */

import { ByteReader, ParseError } from "./reader.ts";
import type {
  Alias,
  Canon,
  CanonicalOptions,
  ComponentDecl,
  CoreExternType,
  CoreInstanceExpr,
  CoreLimits,
  CoreModuleDecl,
  CoreSort,
  CoreSortIdx,
  CoreType,
  DefType,
  DefValType,
  Definition,
  ExternName,
  ExternType,
  InstanceDecl,
  InstanceExpr,
  LabelValType,
  NameAttribute,
  ParsedComponent,
  PrimValType,
  Sort,
  SortIdx,
  TypeBound,
  ValType,
  ValueBound,
  VariantCase,
} from "./ast.ts";

const MAGIC = [0x00, 0x61, 0x73, 0x6d];

/** Component binary versions we understand (0x0d is current pre-standard). */
const SUPPORTED_VERSIONS = new Set([0x0c, 0x0d]);

export function parseComponent(bytes: Uint8Array): ParsedComponent {
  const reader = new ByteReader(bytes);
  return readComponent(reader, bytes);
}

/**
 * True if the binary is a component (layer 1) rather than a core module.
 */
export function isComponent(bytes: Uint8Array): boolean {
  if (bytes.length < 8) {
    return false;
  }
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) {
      return false;
    }
  }
  const layer = bytes[6] | (bytes[7] << 8);
  return layer === 1;
}

function readComponent(reader: ByteReader, bytes: Uint8Array): ParsedComponent {
  const start = reader.pos;
  for (const b of MAGIC) {
    reader.expect(b, "magic");
  }
  const version = reader.byte() | (reader.byte() << 8);
  const layer = reader.byte() | (reader.byte() << 8);
  if (layer !== 1) {
    throw new ParseError(
      layer === 0
        ? "This is a core WebAssembly module, not a component (layer 0)"
        : `Unknown layer ${layer} in preamble`,
    );
  }
  if (!SUPPORTED_VERSIONS.has(version)) {
    throw new ParseError(
      `Unsupported component binary version 0x${version.toString(
        16,
      )} (supported: 0x0c, 0x0d)`,
    );
  }

  const definitions: Definition[] = [];
  while (!reader.done) {
    const id = reader.byte();
    const size = reader.u32();
    const sectionStart = reader.pos;
    const section = reader.subReader(size);
    readSection(id, section, sectionStart, definitions, bytes);
    if (!section.done) {
      throw new ParseError(
        `Section ${id} at offset ${sectionStart} has ${
          section.bytes.length - section.pos
        } trailing bytes`,
      );
    }
  }

  return {
    bytes: bytes.subarray(start),
    version,
    definitions,
  };
}

function readSection(
  id: number,
  r: ByteReader,
  sectionOffset: number,
  definitions: Definition[],
  bytes: Uint8Array,
): void {
  switch (id) {
    case 0: {
      const name = r.name();
      const offset = sectionOffset + r.pos;
      const length = r.bytes.length - r.pos;
      r.raw(length);
      definitions.push({ kind: "custom", name, offset, length });
      return;
    }
    case 1: {
      definitions.push({
        kind: "core-module",
        offset: sectionOffset,
        length: r.bytes.length,
      });
      r.raw(r.bytes.length - r.pos);
      return;
    }
    case 2: {
      for (const expr of r.vec(readCoreInstanceExpr)) {
        definitions.push({ kind: "core-instance", expr });
      }
      return;
    }
    case 3: {
      for (const type of r.vec(readCoreType)) {
        definitions.push({ kind: "core-type", type });
      }
      return;
    }
    case 4: {
      const inner = bytes.subarray(
        sectionOffset,
        sectionOffset + r.bytes.length,
      );
      const component = readComponent(new ByteReader(inner), inner);
      r.raw(r.bytes.length - r.pos);
      definitions.push({ kind: "component", component });
      return;
    }
    case 5: {
      for (const expr of r.vec(readInstanceExpr)) {
        definitions.push({ kind: "instance", expr });
      }
      return;
    }
    case 6: {
      for (const alias of r.vec(readAlias)) {
        definitions.push({ kind: "alias", alias });
      }
      return;
    }
    case 7: {
      for (const type of r.vec(readDefType)) {
        definitions.push({ kind: "type", type });
      }
      return;
    }
    case 8: {
      for (const canon of r.vec(readCanon)) {
        definitions.push({ kind: "canon", canon });
      }
      return;
    }
    case 9: {
      const funcIdx = r.u32();
      const args = r.vec((r) => r.u32());
      const results = r.u32();
      definitions.push({ kind: "start", funcIdx, args, results });
      return;
    }
    case 10: {
      for (const imp of r.vec(readImport)) {
        definitions.push(imp);
      }
      return;
    }
    case 11: {
      for (const exp of r.vec(readExport)) {
        definitions.push(exp);
      }
      return;
    }
    case 12: {
      for (const value of r.vec(readValueDef)) {
        definitions.push({ kind: "value", value });
      }
      return;
    }
    default:
      throw new ParseError(
        `Unknown section id ${id} at offset ${sectionOffset}`,
      );
  }
}

/* ------------------------------------------------------------------ */
/* Sorts                                                               */
/* ------------------------------------------------------------------ */

const CORE_SORTS: Record<number, CoreSort> = {
  0x00: "func",
  0x01: "table",
  0x02: "memory",
  0x03: "global",
  0x04: "tag",
  0x10: "type",
  0x11: "module",
  0x12: "instance",
};

function readCoreSort(r: ByteReader): CoreSort {
  const b = r.byte();
  const sort = CORE_SORTS[b];
  if (sort === undefined) {
    throw new ParseError(
      `Unknown core sort 0x${b.toString(16)} at offset ${r.pos - 1}`,
    );
  }
  return sort;
}

function readSort(r: ByteReader): Sort {
  const b = r.byte();
  switch (b) {
    case 0x00:
      return { core: readCoreSort(r) };
    case 0x01:
      return "func";
    case 0x02:
      return "value";
    case 0x03:
      return "type";
    case 0x04:
      return "component";
    case 0x05:
      return "instance";
    default:
      throw new ParseError(
        `Unknown sort 0x${b.toString(16)} at offset ${r.pos - 1}`,
      );
  }
}

function readSortIdx(r: ByteReader): SortIdx {
  const sort = readSort(r);
  const idx = r.u32();
  return { sort, idx };
}

function readCoreSortIdx(r: ByteReader): CoreSortIdx {
  const sort = readCoreSort(r);
  const idx = r.u32();
  return { sort, idx };
}

/* ------------------------------------------------------------------ */
/* Instance expressions                                                */
/* ------------------------------------------------------------------ */

function readCoreInstanceExpr(r: ByteReader): CoreInstanceExpr {
  const b = r.byte();
  if (b === 0x00) {
    const moduleIdx = r.u32();
    const args = r.vec((r) => {
      const name = r.name();
      r.expect(0x12, "core instantiatearg instance sort");
      const instanceIdx = r.u32();
      return { name, instanceIdx };
    });
    return { kind: "instantiate", moduleIdx, args };
  }
  if (b === 0x01) {
    const exports = r.vec((r) => {
      const name = r.name();
      const sortIdx = readCoreSortIdx(r);
      return { name, sortIdx };
    });
    return { kind: "exports", exports };
  }
  throw new ParseError(
    `Unknown core instance expression 0x${b.toString(16)} at offset ${
      r.pos - 1
    }`,
  );
}

function readInstanceExpr(r: ByteReader): InstanceExpr {
  const b = r.byte();
  if (b === 0x00) {
    const componentIdx = r.u32();
    const args = r.vec((r) => {
      const name = r.name();
      const sortIdx = readSortIdx(r);
      return { name, sortIdx };
    });
    return { kind: "instantiate", componentIdx, args };
  }
  if (b === 0x01) {
    const exports = r.vec((r) => {
      const name = readExternName(r);
      const sortIdx = readSortIdx(r);
      return { name, sortIdx };
    });
    return { kind: "exports", exports };
  }
  throw new ParseError(
    `Unknown instance expression 0x${b.toString(16)} at offset ${r.pos - 1}`,
  );
}

/* ------------------------------------------------------------------ */
/* Aliases                                                             */
/* ------------------------------------------------------------------ */

function readAlias(r: ByteReader): Alias {
  const sort = readSort(r);
  const target = r.byte();
  switch (target) {
    case 0x00: {
      const instanceIdx = r.u32();
      const name = r.name();
      return { kind: "export", sort, instanceIdx, name };
    }
    case 0x01: {
      const instanceIdx = r.u32();
      const name = r.name();
      return { kind: "core-export", sort, instanceIdx, name };
    }
    case 0x02: {
      const count = r.u32();
      const idx = r.u32();
      return { kind: "outer", sort, count, idx };
    }
    default:
      throw new ParseError(
        `Unknown alias target 0x${target.toString(16)} at offset ${r.pos - 1}`,
      );
  }
}

/* ------------------------------------------------------------------ */
/* Component types                                                     */
/* ------------------------------------------------------------------ */

const PRIM_VAL_TYPES: Record<number, PrimValType> = {
  0x7f: "bool",
  0x7e: "s8",
  0x7d: "u8",
  0x7c: "s16",
  0x7b: "u16",
  0x7a: "s32",
  0x79: "u32",
  0x78: "s64",
  0x77: "u64",
  0x76: "f32",
  0x75: "f64",
  0x74: "char",
  0x73: "string",
  0x64: "error-context",
};

function readValType(r: ByteReader): ValType {
  const v = r.s33();
  if (v >= 0) {
    return { ref: v };
  }
  const byte = v & 0x7f;
  const prim = PRIM_VAL_TYPES[byte];
  if (prim === undefined) {
    throw new ParseError(
      `Unknown value type 0x${byte.toString(16)} at offset ${r.pos - 1}`,
    );
  }
  return prim;
}

function readLabelValType(r: ByteReader): LabelValType {
  const label = r.name();
  const type = readValType(r);
  return { label, type };
}

function readCase(r: ByteReader): VariantCase {
  const label = r.name();
  const type = r.optional(readValType);
  r.expect(0x00, "variant case refinement placeholder");
  return type === undefined ? { label } : { label, type };
}

function readDefValTypeByCode(r: ByteReader, code: number): DefValType {
  switch (code) {
    case 0x72:
      return { kind: "record", fields: r.vec(readLabelValType) };
    case 0x71:
      return { kind: "variant", cases: r.vec(readCase) };
    case 0x70:
      return { kind: "list", element: readValType(r) };
    case 0x67: {
      const element = readValType(r);
      const length = r.u32();
      return { kind: "list", element, length };
    }
    case 0x6f:
      return { kind: "tuple", elements: r.vec(readValType) };
    case 0x6e:
      return { kind: "flags", labels: r.vec((r) => r.name()) };
    case 0x6d:
      return { kind: "enum", labels: r.vec((r) => r.name()) };
    case 0x6b:
      return { kind: "option", type: readValType(r) };
    case 0x6a: {
      const ok = r.optional(readValType);
      const error = r.optional(readValType);
      return { kind: "result", ok, error };
    }
    case 0x69:
      return { kind: "own", resource: r.u32() };
    case 0x68:
      return { kind: "borrow", resource: r.u32() };
    case 0x66:
      return { kind: "stream", element: r.optional(readValType) };
    case 0x65:
      return { kind: "future", element: r.optional(readValType) };
    case 0x63: {
      const key = readValType(r);
      const value = readValType(r);
      return { kind: "map", key, value };
    }
    default: {
      const prim = PRIM_VAL_TYPES[code];
      if (prim !== undefined) {
        return prim;
      }
      throw new ParseError(
        `Unknown defined value type 0x${code.toString(16)} at offset ${
          r.pos - 1
        }`,
      );
    }
  }
}

function readDefType(r: ByteReader): DefType {
  const code = r.byte();
  switch (code) {
    case 0x3f: {
      const rep = readValType(r);
      const dtor = r.optional((r) => r.u32());
      return { kind: "resource", rep, dtor };
    }
    case 0x40:
    case 0x43: {
      const params = r.vec(readLabelValType);
      const result = readResultList(r);
      return { kind: "func", async: code === 0x43, params, result };
    }
    case 0x41:
      return { kind: "component", declarations: r.vec(readComponentDecl) };
    case 0x42:
      return { kind: "instance", declarations: r.vec(readInstanceDecl) };
    default:
      return { kind: "defvaltype", type: readDefValTypeByCode(r, code) };
  }
}

function readResultList(r: ByteReader): ValType | undefined {
  const b = r.byte();
  if (b === 0x00) {
    return readValType(r);
  }
  if (b === 0x01) {
    r.expect(0x00, "empty result list");
    return undefined;
  }
  throw new ParseError(
    `Unknown result list discriminant 0x${b.toString(16)} at offset ${
      r.pos - 1
    }`,
  );
}

function readComponentDecl(r: ByteReader): ComponentDecl {
  if (r.peek() === 0x03) {
    r.byte();
    const name = readExternName(r);
    const type = readExternType(r);
    return { kind: "import", name, type };
  }
  return readInstanceDecl(r);
}

function readInstanceDecl(r: ByteReader): InstanceDecl {
  const b = r.byte();
  switch (b) {
    case 0x00:
      return { kind: "core-type", type: readCoreType(r) };
    case 0x01:
      return { kind: "type", type: readDefType(r) };
    case 0x02:
      return { kind: "alias", alias: readAlias(r) };
    case 0x04: {
      const name = readExternName(r);
      const type = readExternType(r);
      return { kind: "export", name, type };
    }
    default:
      throw new ParseError(
        `Unknown instance declaration 0x${b.toString(16)} at offset ${
          r.pos - 1
        }`,
      );
  }
}

function readExternType(r: ByteReader): ExternType {
  const b = r.byte();
  switch (b) {
    case 0x00:
      r.expect(0x11, "core module sort in externtype");
      return { kind: "core-module", typeIdx: r.u32() };
    case 0x01:
      return { kind: "func", typeIdx: r.u32() };
    case 0x02:
      return { kind: "value", bound: readValueBound(r) };
    case 0x03:
      return { kind: "type", bound: readTypeBound(r) };
    case 0x04:
      return { kind: "component", typeIdx: r.u32() };
    case 0x05:
      return { kind: "instance", typeIdx: r.u32() };
    default:
      throw new ParseError(
        `Unknown extern type 0x${b.toString(16)} at offset ${r.pos - 1}`,
      );
  }
}

function readTypeBound(r: ByteReader): TypeBound {
  const b = r.byte();
  if (b === 0x00) {
    return { kind: "eq", typeIdx: r.u32() };
  }
  if (b === 0x01) {
    return { kind: "sub-resource" };
  }
  throw new ParseError(
    `Unknown type bound 0x${b.toString(16)} at offset ${r.pos - 1}`,
  );
}

function readValueBound(r: ByteReader): ValueBound {
  const b = r.byte();
  if (b === 0x00) {
    return { kind: "eq", valueIdx: r.u32() };
  }
  if (b === 0x01) {
    return { kind: "type", type: readValType(r) };
  }
  throw new ParseError(
    `Unknown value bound 0x${b.toString(16)} at offset ${r.pos - 1}`,
  );
}

function readExternName(r: ByteReader): ExternName {
  const b = r.byte();
  if (b === 0x00 || b === 0x01) {
    return { name: r.name() };
  }
  if (b === 0x02) {
    const name = r.name();
    const attributes = r.vec(readNameAttribute);
    return { name, attributes };
  }
  throw new ParseError(
    `Unknown name attributes discriminant 0x${b.toString(16)} at offset ${
      r.pos - 1
    }`,
  );
}

function readNameAttribute(r: ByteReader): NameAttribute {
  const b = r.byte();
  switch (b) {
    case 0x00:
      return { kind: "implements", interface: r.name() };
    case 0x01:
      return { kind: "versionsuffix", suffix: r.name() };
    case 0x02:
      return { kind: "external-id", name: r.name() };
    default:
      throw new ParseError(
        `Unknown name attribute 0x${b.toString(16)} at offset ${r.pos - 1}`,
      );
  }
}

/* ------------------------------------------------------------------ */
/* Imports, exports, values                                            */
/* ------------------------------------------------------------------ */

function readImport(r: ByteReader): Definition {
  const name = readExternName(r);
  const type = readExternType(r);
  return { kind: "import", name, type };
}

function readExport(r: ByteReader): Definition {
  const name = readExternName(r);
  const sortIdx = readSortIdx(r);
  const type = r.optional(readExternType);
  return { kind: "export", name, sortIdx, type };
}

function readValueDef(r: ByteReader): { type: ValType; bytes: Uint8Array } {
  const type = readValType(r);
  const length = r.u32();
  const bytes = r.raw(length);
  return { type, bytes };
}

/* ------------------------------------------------------------------ */
/* Canonical definitions                                               */
/* ------------------------------------------------------------------ */

function readCanonicalOptions(r: ByteReader): CanonicalOptions {
  const options: CanonicalOptions = {
    stringEncoding: "utf8",
    async: false,
  };
  const count = r.u32();
  for (let i = 0; i < count; i++) {
    const b = r.byte();
    switch (b) {
      case 0x00:
        options.stringEncoding = "utf8";
        break;
      case 0x01:
        options.stringEncoding = "utf16";
        break;
      case 0x02:
        options.stringEncoding = "latin1+utf16";
        break;
      case 0x03:
        options.memoryIdx = r.u32();
        break;
      case 0x04:
        options.reallocIdx = r.u32();
        break;
      case 0x05:
        options.postReturnIdx = r.u32();
        break;
      case 0x06:
        options.async = true;
        break;
      case 0x07:
        options.callbackIdx = r.u32();
        break;
      default:
        throw new ParseError(
          `Unknown canonical option 0x${b.toString(16)} at offset ${r.pos - 1}`,
        );
    }
  }
  return options;
}

function readAsyncFlag(r: ByteReader): boolean {
  const b = r.byte();
  if (b === 0x00) return false;
  if (b === 0x01) return true;
  throw new ParseError(
    `Unknown async/cancellable flag 0x${b.toString(16)} at offset ${r.pos - 1}`,
  );
}

function readCanon(r: ByteReader): Canon {
  const b = r.byte();
  switch (b) {
    case 0x00: {
      r.expect(0x00, "func sort in canon lift");
      const coreFuncIdx = r.u32();
      const options = readCanonicalOptions(r);
      const typeIdx = r.u32();
      return { kind: "lift", coreFuncIdx, options, typeIdx };
    }
    case 0x01: {
      r.expect(0x00, "func sort in canon lower");
      const funcIdx = r.u32();
      const options = readCanonicalOptions(r);
      return { kind: "lower", funcIdx, options };
    }
    case 0x02:
      return { kind: "resource.new", typeIdx: r.u32() };
    case 0x03:
      return { kind: "resource.drop", typeIdx: r.u32() };
    case 0x04:
      return { kind: "resource.rep", typeIdx: r.u32() };
    case 0x05:
      return { kind: "task.cancel" };
    case 0x06:
      return { kind: "subtask.cancel", async: readAsyncFlag(r) };
    case 0x09: {
      const result = readResultList(r);
      const options = readCanonicalOptions(r);
      return { kind: "task.return", result, options };
    }
    case 0x0a: {
      const type = readValType(r);
      const slot = r.u32();
      return { kind: "context.get", type, slot };
    }
    case 0x0b: {
      const type = readValType(r);
      const slot = r.u32();
      return { kind: "context.set", type, slot };
    }
    case 0x0c:
      return { kind: "thread.yield", cancellable: readAsyncFlag(r) };
    case 0x0d:
      return { kind: "subtask.drop" };
    case 0x0e:
      return { kind: "stream.new", typeIdx: r.u32() };
    case 0x0f: {
      const typeIdx = r.u32();
      const options = readCanonicalOptions(r);
      return { kind: "stream.read", typeIdx, options };
    }
    case 0x10: {
      const typeIdx = r.u32();
      const options = readCanonicalOptions(r);
      return { kind: "stream.write", typeIdx, options };
    }
    case 0x11:
      return {
        kind: "stream.cancel-read",
        typeIdx: r.u32(),
        async: readAsyncFlag(r),
      };
    case 0x12:
      return {
        kind: "stream.cancel-write",
        typeIdx: r.u32(),
        async: readAsyncFlag(r),
      };
    case 0x13:
      return { kind: "stream.drop-readable", typeIdx: r.u32() };
    case 0x14:
      return { kind: "stream.drop-writable", typeIdx: r.u32() };
    case 0x15:
      return { kind: "future.new", typeIdx: r.u32() };
    case 0x16: {
      const typeIdx = r.u32();
      const options = readCanonicalOptions(r);
      return { kind: "future.read", typeIdx, options };
    }
    case 0x17: {
      const typeIdx = r.u32();
      const options = readCanonicalOptions(r);
      return { kind: "future.write", typeIdx, options };
    }
    case 0x18:
      return {
        kind: "future.cancel-read",
        typeIdx: r.u32(),
        async: readAsyncFlag(r),
      };
    case 0x19:
      return {
        kind: "future.cancel-write",
        typeIdx: r.u32(),
        async: readAsyncFlag(r),
      };
    case 0x1a:
      return { kind: "future.drop-readable", typeIdx: r.u32() };
    case 0x1b:
      return { kind: "future.drop-writable", typeIdx: r.u32() };
    case 0x1c:
      return { kind: "error-context.new", options: readCanonicalOptions(r) };
    case 0x1d:
      return {
        kind: "error-context.debug-message",
        options: readCanonicalOptions(r),
      };
    case 0x1e:
      return { kind: "error-context.drop" };
    case 0x1f:
      return { kind: "waitable-set.new" };
    case 0x20: {
      const cancellable = readAsyncFlag(r);
      const memoryIdx = r.u32();
      return { kind: "waitable-set.wait", cancellable, memoryIdx };
    }
    case 0x21: {
      const cancellable = readAsyncFlag(r);
      const memoryIdx = r.u32();
      return { kind: "waitable-set.poll", cancellable, memoryIdx };
    }
    case 0x22:
      return { kind: "waitable-set.drop" };
    case 0x23:
      return { kind: "waitable.join" };
    case 0x24:
      return { kind: "backpressure.inc" };
    case 0x25:
      return { kind: "backpressure.dec" };
    default:
      throw new ParseError(
        `Unknown canonical definition 0x${b.toString(16)} at offset ${
          r.pos - 1
        }`,
      );
  }
}

/* ------------------------------------------------------------------ */
/* Core types                                                          */
/* ------------------------------------------------------------------ */

const CORE_VAL_TYPES: Record<number, string> = {
  0x7f: "i32",
  0x7e: "i64",
  0x7d: "f32",
  0x7c: "f64",
  0x7b: "v128",
  0x70: "funcref",
  0x6f: "externref",
};

function readCoreValType(r: ByteReader): string {
  const b = r.byte();
  const t = CORE_VAL_TYPES[b];
  if (t !== undefined) {
    return t;
  }
  // GC reference types: (ref null? heaptype)
  if (b === 0x63 || b === 0x64) {
    r.s33(); // heap type
    return "ref";
  }
  throw new ParseError(
    `Unknown core value type 0x${b.toString(16)} at offset ${r.pos - 1}`,
  );
}

function readCoreLimits(r: ByteReader): CoreLimits {
  const flags = r.byte();
  if (flags > 0x07) {
    throw new ParseError(
      `Unknown limits flags 0x${flags.toString(16)} at offset ${r.pos - 1}`,
    );
  }
  const hasMax = (flags & 0x01) !== 0;
  const shared = (flags & 0x02) !== 0;
  const memory64 = (flags & 0x04) !== 0;
  const min = memory64 ? r.u64() : r.u32();
  const max = hasMax ? (memory64 ? r.u64() : r.u32()) : undefined;
  return { min, max, shared, memory64 };
}

function readCoreExternType(r: ByteReader): CoreExternType {
  const b = r.byte();
  switch (b) {
    case 0x00:
      return { kind: "func", typeIdx: r.u32() };
    case 0x01: {
      const refType = readCoreValType(r);
      const limits = readCoreLimits(r);
      return { kind: "table", refType, limits };
    }
    case 0x02:
      return { kind: "memory", limits: readCoreLimits(r) };
    case 0x03: {
      const valType = readCoreValType(r);
      const mut = r.byte();
      return { kind: "global", valType, mutable: mut === 0x01 };
    }
    case 0x04: {
      r.expect(0x00, "tag attribute");
      return { kind: "tag", typeIdx: r.u32() };
    }
    default:
      throw new ParseError(
        `Unknown core extern type 0x${b.toString(16)} at offset ${r.pos - 1}`,
      );
  }
}

function readCoreFuncType(r: ByteReader): CoreType {
  const params = r.vec(readCoreValType);
  const results = r.vec(readCoreValType);
  return { kind: "func", params, results };
}

function readCoreType(r: ByteReader): CoreType {
  const b = r.byte();
  switch (b) {
    case 0x50:
      return { kind: "module", declarations: r.vec(readCoreModuleDecl) };
    case 0x60:
      return readCoreFuncType(r);
    case 0x00: {
      // Pre-1.0 disambiguation: non-final subtype as component core type.
      r.expect(0x50, "non-final subtype prefix");
      r.vec((r) => r.u32());
      return readCoreCompType(r);
    }
    case 0x4e: {
      // rectype with multiple subtypes
      r.vec(readCoreSubType);
      return { kind: "other" };
    }
    case 0x4f: {
      // final subtype with supertype list
      r.vec((r) => r.u32());
      return readCoreCompType(r);
    }
    case 0x5f:
    case 0x5e:
      return readCoreCompTypeByCode(r, b);
    default:
      throw new ParseError(
        `Unknown core type 0x${b.toString(16)} at offset ${r.pos - 1}`,
      );
  }
}

function readCoreSubType(r: ByteReader): CoreType {
  const b = r.byte();
  if (b === 0x50 || b === 0x4f) {
    r.vec((r) => r.u32());
    return readCoreCompType(r);
  }
  return readCoreCompTypeByCode(r, b);
}

function readCoreCompType(r: ByteReader): CoreType {
  return readCoreCompTypeByCode(r, r.byte());
}

function readCoreCompTypeByCode(r: ByteReader, code: number): CoreType {
  switch (code) {
    case 0x60:
      return readCoreFuncType(r);
    case 0x5f: {
      // struct type: vec(fieldtype)
      r.vec(readCoreFieldType);
      return { kind: "other" };
    }
    case 0x5e: {
      readCoreFieldType(r);
      return { kind: "other" };
    }
    default:
      throw new ParseError(
        `Unknown core composite type 0x${code.toString(16)} at offset ${
          r.pos - 1
        }`,
      );
  }
}

function readCoreFieldType(r: ByteReader): void {
  const b = r.peek();
  if (b === 0x78 || b === 0x77) {
    r.byte(); // packed i8/i16 storage type
  } else {
    readCoreValType(r);
  }
  r.byte(); // mutability
}

function readCoreModuleDecl(r: ByteReader): CoreModuleDecl {
  const b = r.byte();
  switch (b) {
    case 0x00: {
      const module = r.name();
      const name = r.name();
      const type = readCoreExternType(r);
      return { kind: "import", module, name, type };
    }
    case 0x01:
      return { kind: "type", type: readCoreType(r) };
    case 0x02: {
      r.expect(0x10, "type sort in core alias");
      r.expect(0x01, "outer target in core alias");
      const count = r.u32();
      const typeIdx = r.u32();
      return { kind: "alias-outer-type", count, typeIdx };
    }
    case 0x03: {
      const name = r.name();
      const type = readCoreExternType(r);
      return { kind: "export", name, type };
    }
    default:
      throw new ParseError(
        `Unknown core module declaration 0x${b.toString(16)} at offset ${
          r.pos - 1
        }`,
      );
  }
}
