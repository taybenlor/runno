/**
 * Resolved runtime types and the type-level canonical ABI operations:
 * despecialization, alignment, element size, flattening and discriminant
 * sizing. Follows design/mvp/CanonicalABI.md.
 */

import { trapIf } from "./errors.ts";

/* ------------------------------------------------------------------ */
/* Runtime types                                                       */
/* ------------------------------------------------------------------ */

export type RTPrim =
  | { k: "bool" }
  | { k: "s8" }
  | { k: "u8" }
  | { k: "s16" }
  | { k: "u16" }
  | { k: "s32" }
  | { k: "u32" }
  | { k: "s64" }
  | { k: "u64" }
  | { k: "f32" }
  | { k: "f64" }
  | { k: "char" }
  | { k: "string" }
  | { k: "error-context" };

export interface RTField {
  label: string;
  camel: string;
  type: RT;
}

export interface RTCase {
  label: string;
  type?: RT;
}

export type RT =
  | RTPrim
  | { k: "record"; fields: RTField[] }
  | { k: "variant"; cases: RTCase[] }
  | { k: "list"; element: RT; length?: number }
  | { k: "tuple"; elements: RT[] }
  | { k: "flags"; labels: string[]; camels: string[] }
  | { k: "enum"; labels: string[] }
  | { k: "option"; type: RT }
  | { k: "result"; ok?: RT; error?: RT }
  | { k: "own"; resource: RTResource }
  | { k: "borrow"; resource: RTResource }
  | { k: "stream"; element?: RT }
  | { k: "future"; element?: RT }
  | { k: "map"; key: RT; value: RT };

export interface RTFuncParam {
  label: string;
  type: RT;
}

export interface RTFunc {
  params: RTFuncParam[];
  result?: RT;
  async: boolean;
}

/**
 * A resource type identity. Two resource types are compatible iff they are
 * the same object. `handles` tables live on component instances; this
 * object carries what's needed to create/destroy representations.
 */
export interface RTResource {
  /** Debug name, from the export/import that introduced it. */
  name: string;
  /**
   * Destructor: called with the rep when an own handle is dropped. For
   * guest-defined resources the linker wires this to the core dtor; for
   * host-defined resources it releases the host object.
   */
  dtor?: (rep: number) => void;
  /**
   * For host-defined resources: rep <-> host JS object bookkeeping.
   * Guest resources don't use this (their rep is guest-managed).
   */
  hosted?: {
    repFor(obj: unknown): number;
    get(rep: number): unknown;
    release(rep: number): unknown;
  };
  /**
   * For host-defined resources supplied as a class (jco convention):
   * used by [constructor]/[static] method dispatch.
   */
  hostClass?: unknown;
  /**
   * The instance state of the component instance that defines this
   * resource — used by the borrow fast path and resource builtins.
   */
  impl?: unknown;
}

/* ------------------------------------------------------------------ */
/* Label conversion (jco-compatible camelCase)                          */
/* ------------------------------------------------------------------ */

export function toCamelCase(label: string): string {
  return label.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

export function toPascalCase(label: string): string {
  const camel = toCamelCase(label);
  return camel.slice(0, 1).toUpperCase() + camel.slice(1);
}

/* ------------------------------------------------------------------ */
/* Despecialization                                                    */
/* ------------------------------------------------------------------ */

/**
 * Rather than allocating despecialized types on every call like the spec's
 * `despecialize`, the size/alignment/flatten functions below handle the
 * specialized types (tuple, enum, option, result, map) directly with the
 * same semantics.
 */

export function discriminantSize(caseCount: number): 1 | 2 | 4 {
  trapIf(caseCount === 0, "variant/enum must have at least one case");
  if (caseCount <= 256) return 1;
  if (caseCount <= 65536) return 2;
  return 4;
}

function variantCases(t: RT): RTCase[] {
  switch (t.k) {
    case "variant":
      return t.cases;
    case "enum":
      return t.labels.map((label) => ({ label }));
    case "option":
      return [{ label: "none" }, { label: "some", type: t.type }];
    case "result":
      return [
        { label: "ok", type: t.ok },
        { label: "error", type: t.error },
      ];
    default:
      throw new Error(`not a variant family type: ${t.k}`);
  }
}

function recordFields(t: RT): { type: RT }[] {
  switch (t.k) {
    case "record":
      return t.fields;
    case "tuple":
      return t.elements.map((type) => ({ type }));
    default:
      throw new Error(`not a record family type: ${t.k}`);
  }
}

/** map<k, v> despecializes to list<tuple<k, v>>. */
function mapElement(t: RT & { k: "map" }): RT {
  return { k: "tuple", elements: [t.key, t.value] };
}

/* ------------------------------------------------------------------ */
/* Alignment                                                           */
/* ------------------------------------------------------------------ */

export function alignment(t: RT): number {
  switch (t.k) {
    case "bool":
    case "s8":
    case "u8":
      return 1;
    case "s16":
    case "u16":
      return 2;
    case "s32":
    case "u32":
    case "f32":
    case "char":
    case "error-context":
    case "own":
    case "borrow":
    case "stream":
    case "future":
      return 4;
    case "s64":
    case "u64":
    case "f64":
      return 8;
    case "string":
      return 4;
    case "list":
      return t.length !== undefined ? alignment(t.element) : 4;
    case "map":
      return 4;
    case "record":
    case "tuple": {
      let a = 1;
      for (const f of recordFields(t)) {
        a = Math.max(a, alignment(f.type));
      }
      return a;
    }
    case "variant":
    case "enum":
    case "option":
    case "result": {
      const cases = variantCases(t);
      let a: number = discriminantSize(cases.length);
      for (const c of cases) {
        if (c.type !== undefined) {
          a = Math.max(a, alignment(c.type));
        }
      }
      return a;
    }
    case "flags":
      return flagsSize(t.labels.length);
  }
}

function flagsSize(n: number): 1 | 2 | 4 {
  trapIf(n === 0 || n > 32, `flags must have 1-32 labels, got ${n}`);
  if (n <= 8) return 1;
  if (n <= 16) return 2;
  return 4;
}

export function alignTo(ptr: number, align: number): number {
  return Math.ceil(ptr / align) * align;
}

/* ------------------------------------------------------------------ */
/* Element size                                                        */
/* ------------------------------------------------------------------ */

export function elemSize(t: RT): number {
  switch (t.k) {
    case "bool":
    case "s8":
    case "u8":
      return 1;
    case "s16":
    case "u16":
      return 2;
    case "s32":
    case "u32":
    case "f32":
    case "char":
    case "error-context":
    case "own":
    case "borrow":
    case "stream":
    case "future":
      return 4;
    case "s64":
    case "u64":
    case "f64":
      return 8;
    case "string":
      return 8;
    case "list":
      return t.length !== undefined ? t.length * elemSize(t.element) : 8;
    case "map":
      return 8;
    case "record":
    case "tuple": {
      let s = 0;
      for (const f of recordFields(t)) {
        s = alignTo(s, alignment(f.type));
        s += elemSize(f.type);
      }
      trapIf(s === 0, "empty record has no size");
      return alignTo(s, alignment(t));
    }
    case "variant":
    case "enum":
    case "option":
    case "result": {
      const cases = variantCases(t);
      let s: number = discriminantSize(cases.length);
      let maxCaseAlign = 1;
      let cs = 0;
      for (const c of cases) {
        if (c.type !== undefined) {
          maxCaseAlign = Math.max(maxCaseAlign, alignment(c.type));
          cs = Math.max(cs, elemSize(c.type));
        }
      }
      s = alignTo(s, maxCaseAlign);
      s += cs;
      return alignTo(s, alignment(t));
    }
    case "flags":
      return flagsSize(t.labels.length);
  }
}

/** Byte offset of the payload within a variant-family value in memory. */
export function payloadOffset(t: RT): number {
  const cases = variantCases(t);
  let s: number = discriminantSize(cases.length);
  let maxCaseAlign = 1;
  for (const c of cases) {
    if (c.type !== undefined) {
      maxCaseAlign = Math.max(maxCaseAlign, alignment(c.type));
    }
  }
  return alignTo(s, maxCaseAlign);
}

export { variantCases, recordFields, mapElement };

/* ------------------------------------------------------------------ */
/* Flattening                                                          */
/* ------------------------------------------------------------------ */

export type CoreValType = "i32" | "i64" | "f32" | "f64";

export const MAX_FLAT_PARAMS = 16;
export const MAX_FLAT_RESULTS = 1;

export function flattenType(t: RT): CoreValType[] {
  switch (t.k) {
    case "bool":
    case "u8":
    case "u16":
    case "u32":
    case "s8":
    case "s16":
    case "s32":
    case "char":
    case "error-context":
    case "own":
    case "borrow":
    case "stream":
    case "future":
      return ["i32"];
    case "s64":
    case "u64":
      return ["i64"];
    case "f32":
      return ["f32"];
    case "f64":
      return ["f64"];
    case "string":
      return ["i32", "i32"];
    case "list":
      if (t.length !== undefined) {
        const flat: CoreValType[] = [];
        for (let i = 0; i < t.length; i++) {
          flat.push(...flattenType(t.element));
        }
        return flat;
      }
      return ["i32", "i32"];
    case "map":
      return ["i32", "i32"];
    case "record":
    case "tuple": {
      const flat: CoreValType[] = [];
      for (const f of recordFields(t)) {
        flat.push(...flattenType(f.type));
      }
      return flat;
    }
    case "variant":
    case "enum":
    case "option":
    case "result":
      return flattenVariant(variantCases(t));
    case "flags":
      return ["i32"];
  }
}

export function flattenVariant(cases: RTCase[]): CoreValType[] {
  const flat: CoreValType[] = [];
  for (const c of cases) {
    if (c.type !== undefined) {
      const caseFlat = flattenType(c.type);
      for (let i = 0; i < caseFlat.length; i++) {
        if (i < flat.length) {
          flat[i] = join(flat[i], caseFlat[i]);
        } else {
          flat.push(caseFlat[i]);
        }
      }
    }
  }
  return ["i32", ...flat];
}

function join(a: CoreValType, b: CoreValType): CoreValType {
  if (a === b) return a;
  if ((a === "i32" && b === "f32") || (a === "f32" && b === "i32")) {
    return "i32";
  }
  return "i64";
}

export function flattenTypes(ts: RT[]): CoreValType[] {
  const flat: CoreValType[] = [];
  for (const t of ts) {
    flat.push(...flattenType(t));
  }
  return flat;
}
