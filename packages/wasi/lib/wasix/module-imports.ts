// Module-instantiation helpers for WASIX: parsing `env.*` import
// descriptors out of the raw wasm binary, and validating host-supplied
// memory/table overrides against those descriptors.
//
// Kept in a dedicated module (not re-exported from lib/main.ts) so the
// logic is directly unit-testable without widening the public API.

/**
 * Descriptor info for the two `env.*` imports that drive WASIX module
 * instantiation. Either field is absent when the binary doesn't import
 * the corresponding entity.
 */
export type ParsedEnvImports = {
  memory?: { initial: number; maximum?: number; shared: boolean };
  table?: {
    element: "funcref" | "externref";
    initial: number;
    maximum?: number;
  };
};

/**
 * Walk the wasm import section just far enough to extract the descriptor
 * for `env.memory` and `env.__indirect_function_table`. The standard
 * `WebAssembly.Module.imports()` API only returns `{ module, name, kind }`
 * — limits and the shared flag are not exposed — so we read them out of
 * the binary directly. Returns descriptors for whichever of the two are
 * present; missing entries map to undefined fields.
 *
 * The parser only descends into section id 2 (Imports) and stops as soon
 * as the imports run out. It tolerates unknown leading custom sections.
 *
 * Wasm binary layout (relevant subset):
 *   magic+version (8 bytes), then a sequence of sections:
 *     section: id:byte, size:varuint32, content:bytes[size]
 *   Imports section content:
 *     count:varuint32, entries:Import[count]
 *   Import:
 *     module:vec<u8>, name:vec<u8>, kind:byte, descriptor
 *   Memory descriptor (kind=2):
 *     limits-flag:byte (bit0=has_max, bit1=shared, bit2=memory64)
 *     min:varuint32 (or varuint64 if memory64)
 *     max:varuint32 (or varuint64) if has_max
 *   Table descriptor (kind=1):
 *     elem-type:byte (0x70=funcref, 0x6f=externref)
 *     limits-flag:byte (bit0=has_max), then min, then max if has_max
 */
export function parseEnvImportDescriptors(bytes: Uint8Array): ParsedEnvImports {
  const out: ParsedEnvImports = {};

  // Magic 0x00 0x61 0x73 0x6d ('\0asm') and version 1.
  if (bytes.length < 8) return out;
  if (
    bytes[0] !== 0x00 ||
    bytes[1] !== 0x61 ||
    bytes[2] !== 0x73 ||
    bytes[3] !== 0x6d
  ) {
    return out;
  }

  let offset = 8;
  const decoder = new TextDecoder();

  while (offset < bytes.length) {
    const sectionId = bytes[offset++];
    const [sectionSize, sizeOffset] = readVarUint32(bytes, offset);
    offset = sizeOffset;
    const sectionEnd = offset + sectionSize;

    if (sectionId !== 2) {
      offset = sectionEnd;
      continue;
    }

    const [importCount, countOffset] = readVarUint32(bytes, offset);
    offset = countOffset;

    for (let i = 0; i < importCount; i++) {
      const [modLen, modLenEnd] = readVarUint32(bytes, offset);
      offset = modLenEnd;
      const modName = decoder.decode(bytes.subarray(offset, offset + modLen));
      offset += modLen;

      const [nmLen, nmLenEnd] = readVarUint32(bytes, offset);
      offset = nmLenEnd;
      const importName = decoder.decode(bytes.subarray(offset, offset + nmLen));
      offset += nmLen;

      const kind = bytes[offset++];

      // 0=function, 1=table, 2=memory, 3=global. We only care about
      // env.memory and env.__indirect_function_table; everything else
      // gets skipped past by reading just enough of its descriptor to
      // advance the cursor.
      if (kind === 0) {
        // function: typeidx
        const [, end] = readVarUint32(bytes, offset);
        offset = end;
      } else if (kind === 1) {
        // table: reftype + limits
        const elemTypeByte = bytes[offset++];
        const flags = bytes[offset++];
        const [initial, afterInitial] = readVarUint32(bytes, offset);
        offset = afterInitial;
        let maximum: number | undefined;
        if (flags & 0x01) {
          const [max, afterMax] = readVarUint32(bytes, offset);
          maximum = max;
          offset = afterMax;
        }
        if (modName === "env" && importName === "__indirect_function_table") {
          const element = elemTypeByte === 0x6f ? "externref" : "funcref";
          out.table = { element, initial, maximum };
        }
      } else if (kind === 2) {
        // memory: limits with shared bit
        const flags = bytes[offset++];
        const isMemory64 = (flags & 0x04) !== 0;
        const [initial, afterInitial] = isMemory64
          ? readVarUint64AsNumber(bytes, offset)
          : readVarUint32(bytes, offset);
        offset = afterInitial;
        let maximum: number | undefined;
        if (flags & 0x01) {
          const [max, afterMax] = isMemory64
            ? readVarUint64AsNumber(bytes, offset)
            : readVarUint32(bytes, offset);
          maximum = max;
          offset = afterMax;
        }
        if (modName === "env" && importName === "memory") {
          out.memory = {
            initial,
            maximum,
            shared: (flags & 0x02) !== 0,
          };
        }
      } else if (kind === 3) {
        // global: valtype + mutability
        offset += 2;
      } else {
        // Unknown kind — bail to be safe rather than misalign the parse.
        return out;
      }
    }

    return out;
  }

  return out;
}

export function readVarUint32(
  bytes: Uint8Array,
  offset: number,
): [number, number] {
  let result = 0;
  let shift = 0;
  while (true) {
    const b = bytes[offset++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) {
      throw new Error("WASIX: malformed varuint32 in module import section");
    }
  }
  return [result >>> 0, offset];
}

export function readVarUint64AsNumber(
  bytes: Uint8Array,
  offset: number,
): [number, number] {
  let result = 0n;
  let shift = 0n;
  while (true) {
    const b = bytes[offset++];
    result |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7n;
    if (shift > 70n) {
      throw new Error("WASIX: malformed varuint64 in module import section");
    }
  }
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("WASIX: memory64 limit exceeds Number.MAX_SAFE_INTEGER");
  }
  return [Number(result), offset];
}

export function validateMemoryOverride(
  memory: WebAssembly.Memory,
  descriptor: { initial: number; maximum?: number; shared: boolean },
): void {
  // Engines expose memory.buffer as a SharedArrayBuffer when the
  // underlying memory is shared.
  const overrideShared =
    typeof SharedArrayBuffer !== "undefined" &&
    memory.buffer instanceof SharedArrayBuffer;
  if (overrideShared !== descriptor.shared) {
    throw new Error(
      `WASIX: provided memory.shared=${overrideShared} does not match ` +
        `module's env.memory.shared=${descriptor.shared}`,
    );
  }
  const overrideInitial = memory.buffer.byteLength / 65536;
  if (overrideInitial < descriptor.initial) {
    throw new Error(
      `WASIX: provided memory has ${overrideInitial} pages but ` +
        `module's env.memory requires initial=${descriptor.initial}`,
    );
  }
  // Maximum is not directly observable on the JS side without a private
  // grow attempt, so we rely on the engine to reject at instantiation
  // time if the override's max is below the descriptor's max.
}

export function validateTableOverride(
  table: WebAssembly.Table,
  descriptor: { element: string; initial: number; maximum?: number },
): void {
  if (table.length < descriptor.initial) {
    throw new Error(
      `WASIX: provided indirect function table has length ${table.length} ` +
        `but module's env.__indirect_function_table requires ` +
        `initial=${descriptor.initial}`,
    );
  }
  // Element type is not introspectable from JS; the engine rejects on
  // mismatch at instantiation time. Maximum likewise.
  void descriptor.element;
  void descriptor.maximum;
}
