/**
 * The Canonical ABI: lifting and lowering of component-level values to and
 * from core wasm values and linear memory. Follows
 * design/mvp/CanonicalABI.md.
 *
 * JS value conventions match jco so ecosystem shims (e.g.
 * @bytecodealliance/preview2-shim) work unchanged:
 *
 * - bool <-> boolean, small ints <-> number, s64/u64 <-> bigint
 * - char <-> single code point string, string <-> string
 * - list<T> <-> Array, except list<u8> lifts to Uint8Array
 * - record <-> object with camelCased keys, tuple <-> array
 * - variant <-> {tag, val?}, enum <-> label string
 * - option<T> <-> T | undefined, but option<option<T>> uses {tag, val}
 * - result <-> {tag: "ok" | "err", val} (unwrapped/thrown at call
 *   boundaries by the linker)
 * - flags <-> object of booleans with camelCased keys
 * - own/borrow of host resources <-> the host JS object; of guest
 *   resources <-> an opaque GuestResource wrapper
 */

import { ComponentTrap, trap, trapIf } from "./errors.ts";
import { CallScope, ResourceHandle, Table } from "./resources.ts";
import {
  alignTo,
  alignment,
  discriminantSize,
  elemSize,
  flattenType,
  flattenTypes,
  flattenVariant,
  payloadOffset,
  variantCases,
  type CoreValType,
  type RT,
  type RTCase,
  type RTResource,
} from "./types.ts";

export type FlatValue = number | bigint;

/** State shared by every canon definition of one component instance. */
export interface InstanceState {
  handles: Table<ResourceHandle>;
  mayLeave: boolean;
}

/**
 * The `cx` of the spec: canonical options plus the instance the options
 * belong to. Memory and realloc resolve lazily because canon definitions
 * can be evaluated before the core instance exporting them exists.
 */
export interface CanonContext {
  memory: () => WebAssembly.Memory;
  realloc?: () => (
    oldPtr: number,
    oldSize: number,
    align: number,
    newSize: number,
  ) => number;
  stringEncoding: "utf8" | "utf16" | "latin1+utf16";
  inst: InstanceState;
  /** Borrow scope of the call currently in progress. */
  scope?: CallScope;
}

function bytes(cx: CanonContext): Uint8Array {
  return new Uint8Array(cx.memory().buffer);
}

function view(cx: CanonContext): DataView {
  return new DataView(cx.memory().buffer);
}

export function allocate(
  cx: CanonContext,
  align: number,
  size: number,
): number {
  const realloc = cx.realloc?.();
  trapIf(realloc === undefined, "realloc is required but was not provided");
  const ptr = realloc!(0, 0, align, size) >>> 0;
  trapIf(ptr !== alignTo(ptr, align), "realloc returned misaligned pointer");
  trapIf(ptr + size > bytes(cx).length, "realloc returned out of bounds");
  return ptr;
}

/* ------------------------------------------------------------------ */
/* Numeric helpers                                                     */
/* ------------------------------------------------------------------ */

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const UTF16_DECODER = new TextDecoder("utf-16le", { fatal: true });
const LATIN1_DECODER = new TextDecoder("latin1");
const UTF8_ENCODER = new TextEncoder();

const MAX_STRING_BYTE_LENGTH = (1 << 28) - 1;

function asU32(v: FlatValue): number {
  if (typeof v === "bigint") {
    return Number(BigInt.asUintN(32, v));
  }
  return v >>> 0;
}

function asF32(v: FlatValue): number {
  return Math.fround(v as number);
}

const CONVERT_BUFFER = new DataView(new ArrayBuffer(8));

function i32BitsToF32(i: number): number {
  CONVERT_BUFFER.setUint32(0, i >>> 0, true);
  return CONVERT_BUFFER.getFloat32(0, true);
}

function f32BitsToI32(f: number): number {
  CONVERT_BUFFER.setFloat32(0, f, true);
  return CONVERT_BUFFER.getUint32(0, true) | 0;
}

function i64BitsToF64(i: bigint): number {
  CONVERT_BUFFER.setBigUint64(0, BigInt.asUintN(64, i), true);
  return CONVERT_BUFFER.getFloat64(0, true);
}

function f64BitsToI64(f: number): bigint {
  CONVERT_BUFFER.setFloat64(0, f, true);
  return CONVERT_BUFFER.getBigInt64(0, true);
}

/* ------------------------------------------------------------------ */
/* Core value iterator                                                 */
/* ------------------------------------------------------------------ */

export class CoreValueIter {
  values: FlatValue[];
  i = 0;

  constructor(values: FlatValue[]) {
    this.values = values;
  }

  next(t: CoreValType): FlatValue {
    trapIf(this.i >= this.values.length, "ran out of core values");
    const v = this.values[this.i++];
    if (t === "i64") {
      return typeof v === "bigint" ? v : BigInt(v);
    }
    if (typeof v === "bigint") {
      trap(`expected ${t} but got i64 value`);
    }
    return v;
  }
}

/* ------------------------------------------------------------------ */
/* Char and string                                                     */
/* ------------------------------------------------------------------ */

function convertI32ToChar(i: number): string {
  const code = i >>> 0;
  trapIf(code >= 0x110000, `char code point ${code} out of range`);
  trapIf(0xd800 <= code && code <= 0xdfff, "char is a surrogate");
  return String.fromCodePoint(code);
}

function charToI32(v: unknown): number {
  const s = String(v);
  const code = s.codePointAt(0);
  trapIf(code === undefined, "char must not be empty");
  trapIf(
    s.length !== (code! > 0xffff ? 2 : 1),
    "char must be a single code point",
  );
  return code!;
}

const UTF16_TAG = 1 << 31;

function loadStringFromRange(
  cx: CanonContext,
  ptr: number,
  taggedCodeUnits: number,
): string {
  let align: number;
  let byteLength: number;
  let decoder: TextDecoder;
  switch (cx.stringEncoding) {
    case "utf8":
      align = 1;
      byteLength = taggedCodeUnits;
      decoder = UTF8_DECODER;
      break;
    case "utf16":
      align = 2;
      byteLength = 2 * taggedCodeUnits;
      decoder = UTF16_DECODER;
      break;
    case "latin1+utf16":
      align = 2;
      if (taggedCodeUnits & UTF16_TAG) {
        byteLength = 2 * (taggedCodeUnits ^ UTF16_TAG);
        decoder = UTF16_DECODER;
      } else {
        byteLength = taggedCodeUnits;
        decoder = LATIN1_DECODER;
      }
      break;
  }
  trapIf(byteLength > MAX_STRING_BYTE_LENGTH, "string too long");
  trapIf(ptr !== alignTo(ptr, align), "string pointer misaligned");
  const memory = bytes(cx);
  trapIf(ptr + byteLength > memory.length, "string out of bounds");
  try {
    // Copy before decoding: TextDecoder rejects SharedArrayBuffer views
    // and the underlying buffer may move on grow.
    return decoder.decode(memory.slice(ptr, ptr + byteLength));
  } catch {
    trap("string is not valid in its declared encoding");
  }
}

/** Returns [ptr, taggedCodeUnits]. */
function storeStringIntoRange(cx: CanonContext, v: unknown): [number, number] {
  const s = String(v);
  switch (cx.stringEncoding) {
    case "utf8": {
      const encoded = UTF8_ENCODER.encode(s);
      trapIf(encoded.length > MAX_STRING_BYTE_LENGTH, "string too long");
      const ptr = allocate(cx, 1, encoded.length);
      bytes(cx).set(encoded, ptr);
      return [ptr, encoded.length];
    }
    case "utf16": {
      const byteLength = 2 * s.length;
      trapIf(byteLength > MAX_STRING_BYTE_LENGTH, "string too long");
      const ptr = allocate(cx, 2, byteLength);
      const dv = view(cx);
      for (let i = 0; i < s.length; i++) {
        dv.setUint16(ptr + 2 * i, s.charCodeAt(i), true);
      }
      return [ptr, s.length];
    }
    case "latin1+utf16": {
      let isLatin1 = true;
      for (let i = 0; i < s.length; i++) {
        if (s.charCodeAt(i) > 0xff) {
          isLatin1 = false;
          break;
        }
      }
      if (isLatin1) {
        trapIf(s.length > MAX_STRING_BYTE_LENGTH, "string too long");
        const ptr = allocate(cx, 2, s.length);
        const memory = bytes(cx);
        for (let i = 0; i < s.length; i++) {
          memory[ptr + i] = s.charCodeAt(i);
        }
        return [ptr, s.length];
      }
      const byteLength = 2 * s.length;
      trapIf(byteLength > MAX_STRING_BYTE_LENGTH, "string too long");
      const ptr = allocate(cx, 2, byteLength);
      const dv = view(cx);
      for (let i = 0; i < s.length; i++) {
        dv.setUint16(ptr + 2 * i, s.charCodeAt(i), true);
      }
      return [ptr, s.length | UTF16_TAG];
    }
  }
}

/* ------------------------------------------------------------------ */
/* Resources at the JS boundary                                        */
/* ------------------------------------------------------------------ */

/**
 * An own or borrow handle to a guest-implemented resource, as seen by the
 * host. Pass it back into guest calls, or dispose it to run the guest
 * destructor.
 */
export class GuestResource {
  /** @internal */
  rt: RTResource;
  /** @internal */
  rep: number;
  own: boolean;
  /** @internal */
  dropped = false;

  /** @internal */
  constructor(rt: RTResource, rep: number, own: boolean) {
    this.rt = rt;
    this.rep = rep;
    this.own = own;
  }

  [Symbol.dispose](): void {
    if (this.own && !this.dropped) {
      this.dropped = true;
      this.rt.dtor?.(this.rep);
    }
  }
}

/** Host-object <-> rep bookkeeping for a host-implemented resource. */
export class HostResourceTable {
  private repsByObject = new WeakMap<object, number>();
  private objectsByRep = new Map<number, unknown>();
  private nextRep = 1;

  repFor(obj: unknown): number {
    trapIf(
      typeof obj !== "object" || obj === null,
      "host resource must be an object",
    );
    let rep = this.repsByObject.get(obj as object);
    if (rep === undefined) {
      rep = this.nextRep++;
      this.repsByObject.set(obj as object, rep);
    }
    this.objectsByRep.set(rep, obj);
    return rep;
  }

  get(rep: number): unknown {
    const obj = this.objectsByRep.get(rep);
    trapIf(obj === undefined, `unknown host resource rep ${rep}`);
    return obj;
  }

  release(rep: number): unknown {
    const obj = this.get(rep);
    this.objectsByRep.delete(rep);
    return obj;
  }
}

function liftOwn(cx: CanonContext, i: number, rt: RTResource): unknown {
  const h = cx.inst.handles.remove(i);
  trapIf(h.rt !== rt, "own handle has wrong resource type");
  trapIf(h.numLends !== 0, "own handle is currently lent");
  trapIf(!h.own, "expected an own handle");
  return repToJs(rt, h.rep, true);
}

function liftBorrow(cx: CanonContext, i: number, rt: RTResource): unknown {
  const h = cx.inst.handles.get(i);
  trapIf(h.rt !== rt, "borrow handle has wrong resource type");
  cx.scope?.addLender(h);
  return repToJs(rt, h.rep, false);
}

function repToJs(rt: RTResource, rep: number, takeOwnership: boolean): unknown {
  if (rt.hosted) {
    return takeOwnership ? rt.hosted.release(rep) : rt.hosted.get(rep);
  }
  return new GuestResource(rt, rep, takeOwnership);
}

function lowerOwn(cx: CanonContext, v: unknown, rt: RTResource): number {
  const h = new ResourceHandle(rt, jsToRep(rt, v, true), true);
  return cx.inst.handles.add(h);
}

function lowerBorrow(cx: CanonContext, v: unknown, rt: RTResource): number {
  const rep = jsToRep(rt, v, false);
  if (rt.impl && cx.inst === rt.impl) {
    return rep;
  }
  const h = new ResourceHandle(rt, rep, false, cx.scope);
  if (cx.scope) {
    cx.scope.numBorrows++;
  }
  return cx.inst.handles.add(h);
}

function jsToRep(rt: RTResource, v: unknown, _takeOwnership: boolean): number {
  if (rt.hosted) {
    return rt.hosted.repFor(v);
  }
  trapIf(
    !(v instanceof GuestResource),
    `expected a ${rt.name} resource handle`,
  );
  const res = v as GuestResource;
  trapIf(res.rt !== rt, `resource is not a ${rt.name}`);
  trapIf(res.dropped, "resource was already disposed");
  if (res.own && _takeOwnership) {
    res.dropped = true;
  }
  return res.rep;
}

/* ------------------------------------------------------------------ */
/* Loading from memory                                                 */
/* ------------------------------------------------------------------ */

export function load(cx: CanonContext, ptr: number, t: RT): unknown {
  const dv = view(cx);
  switch (t.k) {
    case "bool":
      return dv.getUint8(ptr) !== 0;
    case "u8":
      return dv.getUint8(ptr);
    case "s8":
      return dv.getInt8(ptr);
    case "u16":
      return dv.getUint16(ptr, true);
    case "s16":
      return dv.getInt16(ptr, true);
    case "u32":
      return dv.getUint32(ptr, true);
    case "s32":
      return dv.getInt32(ptr, true);
    case "u64":
      return dv.getBigUint64(ptr, true);
    case "s64":
      return dv.getBigInt64(ptr, true);
    case "f32":
      return dv.getFloat32(ptr, true);
    case "f64":
      return dv.getFloat64(ptr, true);
    case "char":
      return convertI32ToChar(dv.getUint32(ptr, true));
    case "string": {
      const begin = dv.getUint32(ptr, true);
      const taggedCodeUnits = dv.getUint32(ptr + 4, true);
      return loadStringFromRange(cx, begin, taggedCodeUnits);
    }
    case "list": {
      if (t.length !== undefined) {
        return loadListElements(cx, ptr, t.element, t.length);
      }
      const begin = dv.getUint32(ptr, true);
      const length = dv.getUint32(ptr + 4, true);
      return loadListFromRange(cx, begin, length, t.element);
    }
    case "map": {
      const begin = dv.getUint32(ptr, true);
      const length = dv.getUint32(ptr + 4, true);
      const entries = loadListFromRange(cx, begin, length, {
        k: "tuple",
        elements: [t.key, t.value],
      }) as [unknown, unknown][];
      return new Map(entries);
    }
    case "record": {
      const result: Record<string, unknown> = {};
      let offset = ptr;
      for (const f of t.fields) {
        offset = alignTo(offset, alignment(f.type));
        result[f.camel] = load(cx, offset, f.type);
        offset += elemSize(f.type);
      }
      return result;
    }
    case "tuple": {
      const result: unknown[] = [];
      let offset = ptr;
      for (const el of t.elements) {
        offset = alignTo(offset, alignment(el));
        result.push(load(cx, offset, el));
        offset += elemSize(el);
      }
      return result;
    }
    case "flags": {
      const size = elemSize(t);
      const packed =
        size === 1
          ? dv.getUint8(ptr)
          : size === 2
            ? dv.getUint16(ptr, true)
            : dv.getUint32(ptr, true);
      return unpackFlags(packed, t.camels);
    }
    case "variant":
    case "enum":
    case "option":
    case "result": {
      const cases = variantCases(t);
      const dsize = discriminantSize(cases.length);
      const disc =
        dsize === 1
          ? dv.getUint8(ptr)
          : dsize === 2
            ? dv.getUint16(ptr, true)
            : dv.getUint32(ptr, true);
      trapIf(disc >= cases.length, "variant discriminant out of range");
      const c = cases[disc];
      const value =
        c.type === undefined
          ? undefined
          : load(cx, ptr + payloadOffset(t), c.type);
      return variantToJs(t, disc, c, value);
    }
    case "own":
      return liftOwn(cx, dv.getUint32(ptr, true), t.resource);
    case "borrow":
      return liftBorrow(cx, dv.getUint32(ptr, true), t.resource);
    case "error-context":
    case "stream":
    case "future":
      trap(`${t.k} values are not supported yet`);
  }
}

function loadListFromRange(
  cx: CanonContext,
  ptr: number,
  length: number,
  elementType: RT,
): unknown {
  const size = elemSize(elementType);
  trapIf(
    ptr !== alignTo(ptr, alignment(elementType)),
    "list pointer misaligned",
  );
  trapIf(ptr + length * size > bytes(cx).length, "list out of bounds");
  if (elementType.k === "u8") {
    return bytes(cx).slice(ptr, ptr + length);
  }
  return loadListElements(cx, ptr, elementType, length);
}

function loadListElements(
  cx: CanonContext,
  ptr: number,
  elementType: RT,
  length: number,
): unknown[] {
  const result: unknown[] = [];
  const size = elemSize(elementType);
  for (let i = 0; i < length; i++) {
    result.push(load(cx, ptr + i * size, elementType));
  }
  return result;
}

function unpackFlags(
  packed: number,
  camels: string[],
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (let i = 0; i < camels.length; i++) {
    result[camels[i]] = (packed & (1 << i)) !== 0;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Variant <-> JS                                                      */
/* ------------------------------------------------------------------ */

/**
 * option<T> lifts to undefined | T, except when T is itself an option (or
 * can lift to undefined) where {tag: "some"/"none", val} is used to stay
 * lossless — same disambiguation rule as jco.
 */
function optionNeedsTag(t: RT & { k: "option" }): boolean {
  return t.type.k === "option";
}

function variantToJs(t: RT, disc: number, c: RTCase, value: unknown): unknown {
  switch (t.k) {
    case "enum":
      return c.label;
    case "option":
      if (optionNeedsTag(t)) {
        return disc === 0 ? { tag: "none" } : { tag: "some", val: value };
      }
      return disc === 0 ? undefined : value;
    case "result":
      return disc === 0
        ? { tag: "ok", val: value }
        : { tag: "err", val: value };
    default:
      return c.type === undefined
        ? { tag: c.label }
        : { tag: c.label, val: value };
  }
}

/** Returns [caseIndex, payloadValue]. */
function jsToVariant(t: RT, v: unknown): [number, unknown] {
  const cases = variantCases(t);
  switch (t.k) {
    case "enum": {
      const index = t.labels.indexOf(String(v));
      trapIf(index < 0, `unknown enum case: ${String(v)}`);
      return [index, undefined];
    }
    case "option": {
      if (optionNeedsTag(t)) {
        const tagged = v as { tag?: string; val?: unknown } | undefined;
        if (tagged && tagged.tag === "some") return [1, tagged.val];
        if (tagged && tagged.tag === "none") return [0, undefined];
        trap("option value must be {tag: 'some'|'none'}");
      }
      return v === undefined || v === null ? [0, undefined] : [1, v];
    }
    case "result": {
      const tagged = v as { tag?: string; val?: unknown };
      if (tagged && tagged.tag === "ok") return [0, tagged.val];
      if (tagged && tagged.tag === "err") return [1, tagged.val];
      trap("result value must be {tag: 'ok'|'err'}");
      break;
    }
    default: {
      const tagged = v as { tag?: string; val?: unknown };
      trapIf(
        tagged === null || typeof tagged !== "object" || !tagged.tag,
        "variant value must be {tag, val?}",
      );
      const index = cases.findIndex((c) => c.label === tagged.tag);
      trapIf(index < 0, `unknown variant case: ${tagged.tag}`);
      return [index, tagged.val];
    }
  }
}

/* ------------------------------------------------------------------ */
/* Storing into memory                                                 */
/* ------------------------------------------------------------------ */

export function store(cx: CanonContext, v: unknown, t: RT, ptr: number): void {
  const dv = view(cx);
  switch (t.k) {
    case "bool":
      dv.setUint8(ptr, v ? 1 : 0);
      return;
    case "u8":
      dv.setUint8(ptr, Number(v) & 0xff);
      return;
    case "s8":
      dv.setInt8(ptr, (Number(v) & 0xff) | 0);
      return;
    case "u16":
      dv.setUint16(ptr, Number(v) & 0xffff, true);
      return;
    case "s16":
      dv.setInt16(ptr, Number(v), true);
      return;
    case "u32":
      dv.setUint32(ptr, Number(v) >>> 0, true);
      return;
    case "s32":
      dv.setInt32(ptr, Number(v) | 0, true);
      return;
    case "u64":
      dv.setBigUint64(ptr, BigInt.asUintN(64, toBigInt(v)), true);
      return;
    case "s64":
      dv.setBigInt64(ptr, BigInt.asIntN(64, toBigInt(v)), true);
      return;
    case "f32":
      dv.setFloat32(ptr, Number(v), true);
      return;
    case "f64":
      dv.setFloat64(ptr, Number(v), true);
      return;
    case "char":
      dv.setUint32(ptr, charToI32(v), true);
      return;
    case "string": {
      const [begin, taggedCodeUnits] = storeStringIntoRange(cx, v);
      // Re-create the view: realloc may have grown memory.
      const dv2 = view(cx);
      dv2.setUint32(ptr, begin, true);
      dv2.setUint32(ptr + 4, taggedCodeUnits, true);
      return;
    }
    case "list": {
      if (t.length !== undefined) {
        storeListElements(cx, v, t.element, ptr, t.length);
        return;
      }
      const [begin, length] = storeListIntoRange(cx, v, t.element);
      const dv2 = view(cx);
      dv2.setUint32(ptr, begin, true);
      dv2.setUint32(ptr + 4, length, true);
      return;
    }
    case "map": {
      const entries = mapToEntries(v);
      const [begin, length] = storeListIntoRange(cx, entries, {
        k: "tuple",
        elements: [t.key, t.value],
      });
      const dv2 = view(cx);
      dv2.setUint32(ptr, begin, true);
      dv2.setUint32(ptr + 4, length, true);
      return;
    }
    case "record": {
      const obj = v as Record<string, unknown>;
      let offset = ptr;
      for (const f of t.fields) {
        offset = alignTo(offset, alignment(f.type));
        store(cx, obj[f.camel], f.type, offset);
        offset += elemSize(f.type);
      }
      return;
    }
    case "tuple": {
      const arr = v as unknown[];
      trapIf(
        !Array.isArray(arr) || arr.length !== t.elements.length,
        `tuple must be an array of ${t.elements.length} values`,
      );
      let offset = ptr;
      for (let i = 0; i < t.elements.length; i++) {
        offset = alignTo(offset, alignment(t.elements[i]));
        store(cx, arr[i], t.elements[i], offset);
        offset += elemSize(t.elements[i]);
      }
      return;
    }
    case "flags": {
      const packed = packFlags(v, t.camels);
      const size = elemSize(t);
      if (size === 1) dv.setUint8(ptr, packed);
      else if (size === 2) dv.setUint16(ptr, packed, true);
      else dv.setUint32(ptr, packed >>> 0, true);
      return;
    }
    case "variant":
    case "enum":
    case "option":
    case "result": {
      const cases = variantCases(t);
      const [disc, payload] = jsToVariant(t, v);
      const dsize = discriminantSize(cases.length);
      if (dsize === 1) dv.setUint8(ptr, disc);
      else if (dsize === 2) dv.setUint16(ptr, disc, true);
      else dv.setUint32(ptr, disc, true);
      const c = cases[disc];
      if (c.type !== undefined) {
        store(cx, payload, c.type, ptr + payloadOffset(t));
      }
      return;
    }
    case "own":
      dv.setUint32(ptr, lowerOwn(cx, v, t.resource), true);
      return;
    case "borrow":
      dv.setUint32(ptr, lowerBorrow(cx, v, t.resource), true);
      return;
    case "error-context":
    case "stream":
    case "future":
      trap(`${t.k} values are not supported yet`);
  }
}

function toBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (typeof v === "boolean") return v ? 1n : 0n;
  if (typeof v === "string") return BigInt(v);
  trap(`cannot convert ${typeof v} to a 64-bit integer`);
}

function packFlags(v: unknown, camels: string[]): number {
  const obj = (v ?? {}) as Record<string, unknown>;
  let packed = 0;
  for (let i = 0; i < camels.length; i++) {
    if (obj[camels[i]]) {
      packed |= 1 << i;
    }
  }
  return packed;
}

function mapToEntries(v: unknown): [unknown, unknown][] {
  if (v instanceof Map) return [...v.entries()];
  if (Array.isArray(v)) return v as [unknown, unknown][];
  trap("map value must be a Map or an array of [key, value] pairs");
}

function listLength(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (ArrayBuffer.isView(v)) return (v as unknown as { length: number }).length;
  if (typeof v === "string") return v.length;
  trap("list value must be an array or typed array");
}

function listItem(v: unknown, i: number): unknown {
  return (v as { [n: number]: unknown })[i];
}

/** Returns [ptr, length]. */
function storeListIntoRange(
  cx: CanonContext,
  v: unknown,
  elementType: RT,
): [number, number] {
  const length = listLength(v);
  const size = elemSize(elementType);
  const byteLength = length * size;
  trapIf(byteLength >= 2 ** 32, "list too long");
  const ptr = allocate(cx, alignment(elementType), byteLength);
  if (elementType.k === "u8") {
    const src =
      v instanceof Uint8Array ? v : Uint8Array.from(v as ArrayLike<number>);
    bytes(cx).set(src, ptr);
    return [ptr, length];
  }
  storeListElements(cx, v, elementType, ptr, length);
  return [ptr, length];
}

function storeListElements(
  cx: CanonContext,
  v: unknown,
  elementType: RT,
  ptr: number,
  expectedLength: number,
): void {
  const length = listLength(v);
  trapIf(
    length !== expectedLength,
    `expected list of length ${expectedLength}, got ${length}`,
  );
  const size = elemSize(elementType);
  for (let i = 0; i < length; i++) {
    store(cx, listItem(v, i), elementType, ptr + i * size);
  }
}

/* ------------------------------------------------------------------ */
/* Flat lifting                                                        */
/* ------------------------------------------------------------------ */

export function liftFlat(cx: CanonContext, vi: CoreValueIter, t: RT): unknown {
  switch (t.k) {
    case "bool":
      return asU32(vi.next("i32")) !== 0;
    case "u8":
      return asU32(vi.next("i32")) % 0x100;
    case "u16":
      return asU32(vi.next("i32")) % 0x10000;
    case "u32":
      return asU32(vi.next("i32"));
    case "s8": {
      const i = asU32(vi.next("i32")) % 0x100;
      return i >= 0x80 ? i - 0x100 : i;
    }
    case "s16": {
      const i = asU32(vi.next("i32")) % 0x10000;
      return i >= 0x8000 ? i - 0x10000 : i;
    }
    case "s32":
      return asU32(vi.next("i32")) | 0;
    case "u64":
      return BigInt.asUintN(64, vi.next("i64") as bigint);
    case "s64":
      return BigInt.asIntN(64, vi.next("i64") as bigint);
    case "f32":
      return asF32(vi.next("f32") as number);
    case "f64":
      return vi.next("f64") as number;
    case "char":
      return convertI32ToChar(asU32(vi.next("i32")));
    case "string": {
      const ptr = asU32(vi.next("i32"));
      const packed = asU32(vi.next("i32"));
      return loadStringFromRange(cx, ptr, packed);
    }
    case "list": {
      if (t.length !== undefined) {
        const result: unknown[] = [];
        for (let i = 0; i < t.length; i++) {
          result.push(liftFlat(cx, vi, t.element));
        }
        return result;
      }
      const ptr = asU32(vi.next("i32"));
      const length = asU32(vi.next("i32"));
      return loadListFromRange(cx, ptr, length, t.element);
    }
    case "map": {
      const ptr = asU32(vi.next("i32"));
      const length = asU32(vi.next("i32"));
      const entries = loadListFromRange(cx, ptr, length, {
        k: "tuple",
        elements: [t.key, t.value],
      }) as [unknown, unknown][];
      return new Map(entries);
    }
    case "record": {
      const result: Record<string, unknown> = {};
      for (const f of t.fields) {
        result[f.camel] = liftFlat(cx, vi, f.type);
      }
      return result;
    }
    case "tuple": {
      const result: unknown[] = [];
      for (const el of t.elements) {
        result.push(liftFlat(cx, vi, el));
      }
      return result;
    }
    case "flags":
      return unpackFlags(asU32(vi.next("i32")), t.camels);
    case "variant":
    case "enum":
    case "option":
    case "result": {
      const cases = variantCases(t);
      const flatTypes = flattenVariant(cases).slice(1);
      const disc = asU32(vi.next("i32"));
      trapIf(disc >= cases.length, "variant discriminant out of range");
      const c = cases[disc];
      let value: unknown;
      if (c.type !== undefined) {
        const coerce = new CoerceValueIter(vi, flatTypes);
        value = liftFlat(cx, coerce as unknown as CoreValueIter, c.type);
        for (const remaining of coerce.remaining()) {
          vi.next(remaining);
        }
      } else {
        for (const have of flatTypes) {
          vi.next(have);
        }
      }
      return variantToJs(t, disc, c, value);
    }
    case "own":
      return liftOwn(cx, asU32(vi.next("i32")), t.resource);
    case "borrow":
      return liftBorrow(cx, asU32(vi.next("i32")), t.resource);
    case "error-context":
    case "stream":
    case "future":
      trap(`${t.k} values are not supported yet`);
  }
}

/**
 * Iterator wrapper implementing the spec's CoerceValueIter: reinterprets
 * the joined variant flat types into what the payload wants.
 */
class CoerceValueIter {
  private vi: CoreValueIter;
  private flatTypes: CoreValType[];
  private index = 0;

  constructor(vi: CoreValueIter, flatTypes: CoreValType[]) {
    this.vi = vi;
    this.flatTypes = flatTypes;
  }

  next(want: CoreValType): FlatValue {
    trapIf(this.index >= this.flatTypes.length, "variant payload overflow");
    const have = this.flatTypes[this.index++];
    const x = this.vi.next(have);
    if (have === "i32" && want === "f32") {
      return i32BitsToF32(asU32(x));
    }
    if (have === "i64" && want === "i32") {
      return Number(BigInt.asUintN(32, x as bigint));
    }
    if (have === "i64" && want === "f32") {
      return i32BitsToF32(Number(BigInt.asUintN(32, x as bigint)));
    }
    if (have === "i64" && want === "f64") {
      return i64BitsToF64(x as bigint);
    }
    trapIf(have !== want, `variant payload type mismatch: ${have} vs ${want}`);
    return x;
  }

  remaining(): CoreValType[] {
    return this.flatTypes.slice(this.index);
  }
}

/* ------------------------------------------------------------------ */
/* Flat lowering                                                       */
/* ------------------------------------------------------------------ */

export function lowerFlat(cx: CanonContext, v: unknown, t: RT): FlatValue[] {
  switch (t.k) {
    case "bool":
      return [v ? 1 : 0];
    case "u8":
      return [Number(v) & 0xff];
    case "u16":
      return [Number(v) & 0xffff];
    case "u32":
      return [Number(v) >>> 0];
    case "s8":
    case "s16":
    case "s32": {
      let i = Number(v) | 0;
      if (i < 0) i += 2 ** 32;
      return [i >>> 0];
    }
    case "u64":
      return [BigInt.asUintN(64, toBigInt(v))];
    case "s64":
      return [BigInt.asUintN(64, toBigInt(v))];
    case "f32":
      return [asF32(Number(v))];
    case "f64":
      return [Number(v)];
    case "char":
      return [charToI32(v)];
    case "string": {
      const [ptr, packed] = storeStringIntoRange(cx, v);
      return [ptr, packed];
    }
    case "list": {
      if (t.length !== undefined) {
        const flat: FlatValue[] = [];
        const length = listLength(v);
        trapIf(length !== t.length, `expected list of length ${t.length}`);
        for (let i = 0; i < length; i++) {
          flat.push(...lowerFlat(cx, listItem(v, i), t.element));
        }
        return flat;
      }
      const [ptr, length] = storeListIntoRange(cx, v, t.element);
      return [ptr, length];
    }
    case "map": {
      const [ptr, length] = storeListIntoRange(cx, mapToEntries(v), {
        k: "tuple",
        elements: [t.key, t.value],
      });
      return [ptr, length];
    }
    case "record": {
      const obj = v as Record<string, unknown>;
      const flat: FlatValue[] = [];
      for (const f of t.fields) {
        flat.push(...lowerFlat(cx, obj[f.camel], f.type));
      }
      return flat;
    }
    case "tuple": {
      const arr = v as unknown[];
      trapIf(
        !Array.isArray(arr) || arr.length !== t.elements.length,
        `tuple must be an array of ${t.elements.length} values`,
      );
      const flat: FlatValue[] = [];
      for (let i = 0; i < t.elements.length; i++) {
        flat.push(...lowerFlat(cx, arr[i], t.elements[i]));
      }
      return flat;
    }
    case "flags":
      return [packFlags(v, t.camels) >>> 0];
    case "variant":
    case "enum":
    case "option":
    case "result": {
      const cases = variantCases(t);
      const [disc, payload] = jsToVariant(t, v);
      const flatTypes = flattenVariant(cases).slice(1);
      const c = cases[disc];
      const flat: FlatValue[] = [];
      if (c.type !== undefined) {
        const payloadFlat = lowerFlat(cx, payload, c.type);
        const haveTypes = flattenType(c.type);
        for (let i = 0; i < payloadFlat.length; i++) {
          const have = haveTypes[i];
          const want = flatTypes[i];
          let fv = payloadFlat[i];
          if (have === "f32" && want === "i32") {
            fv = f32BitsToI32(fv as number) >>> 0;
          } else if (have === "i32" && want === "i64") {
            fv = BigInt(asU32(fv));
          } else if (have === "f32" && want === "i64") {
            fv = BigInt(f32BitsToI32(fv as number) >>> 0);
          } else if (have === "f64" && want === "i64") {
            fv = BigInt.asUintN(64, f64BitsToI64(fv as number));
          }
          flat.push(fv);
        }
      }
      // Pad remaining joined slots with zeroes of the right shape.
      for (let i = flat.length; i < flatTypes.length; i++) {
        flat.push(flatTypes[i] === "i64" ? 0n : 0);
      }
      return [disc, ...flat];
    }
    case "own":
      return [lowerOwn(cx, v, t.resource)];
    case "borrow":
      return [lowerBorrow(cx, v, t.resource)];
    case "error-context":
    case "stream":
    case "future":
      trap(`${t.k} values are not supported yet`);
  }
}

/* ------------------------------------------------------------------ */
/* Parameter/result spilling                                           */
/* ------------------------------------------------------------------ */

export function liftFlatValues(
  cx: CanonContext,
  maxFlat: number,
  vi: CoreValueIter,
  ts: RT[],
): unknown[] {
  const flatTypes = flattenTypes(ts);
  if (flatTypes.length > maxFlat) {
    const tupleType: RT = { k: "tuple", elements: ts };
    const ptr = asU32(vi.next("i32"));
    trapIf(
      ptr !== alignTo(ptr, alignment(tupleType)),
      "spilled arguments pointer misaligned",
    );
    trapIf(
      ptr + elemSize(tupleType) > bytes(cx).length,
      "spilled arguments out of bounds",
    );
    return load(cx, ptr, tupleType) as unknown[];
  }
  return ts.map((t) => liftFlat(cx, vi, t));
}

export function lowerFlatValues(
  cx: CanonContext,
  maxFlat: number,
  vs: unknown[],
  ts: RT[],
  outPtr?: number,
): FlatValue[] {
  const flatTypes = flattenTypes(ts);
  if (flatTypes.length > maxFlat) {
    const tupleType: RT = { k: "tuple", elements: ts };
    let ptr: number;
    let flatVals: FlatValue[];
    if (outPtr === undefined) {
      ptr = allocate(cx, alignment(tupleType), elemSize(tupleType));
      flatVals = [ptr];
    } else {
      ptr = outPtr;
      flatVals = [];
    }
    trapIf(
      ptr !== alignTo(ptr, alignment(tupleType)),
      "spill pointer misaligned",
    );
    trapIf(
      ptr + elemSize(tupleType) > bytes(cx).length,
      "spill pointer out of bounds",
    );
    store(cx, vs, tupleType, ptr);
    return flatVals;
  }
  const flat: FlatValue[] = [];
  for (let i = 0; i < ts.length; i++) {
    flat.push(...lowerFlat(cx, vs[i], ts[i]));
  }
  return flat;
}

export { ComponentTrap };
