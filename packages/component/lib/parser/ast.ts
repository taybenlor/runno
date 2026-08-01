/**
 * AST for the Component Model binary format.
 *
 * The structure mirrors design/mvp/Binary.md in the WebAssembly/component-model
 * repository. A parsed component is an ordered list of definitions — order
 * matters because every definition appends to one of the index spaces
 * (core funcs/tables/memories/globals/types/modules/instances, and component
 * funcs/values/types/components/instances) and later definitions refer to
 * earlier ones by index.
 */

/* ------------------------------------------------------------------ */
/* Sorts                                                               */
/* ------------------------------------------------------------------ */

export type CoreSort =
  | "func"
  | "table"
  | "memory"
  | "global"
  | "tag"
  | "type"
  | "module"
  | "instance";

export type Sort =
  | { core: CoreSort }
  | "func"
  | "value"
  | "type"
  | "component"
  | "instance";

export interface SortIdx {
  sort: Sort;
  idx: number;
}

export interface CoreSortIdx {
  sort: CoreSort;
  idx: number;
}

/* ------------------------------------------------------------------ */
/* Value types                                                         */
/* ------------------------------------------------------------------ */

export type PrimValType =
  | "bool"
  | "s8"
  | "u8"
  | "s16"
  | "u16"
  | "s32"
  | "u32"
  | "s64"
  | "u64"
  | "f32"
  | "f64"
  | "char"
  | "string"
  | "error-context";

/** A value type is either a primitive or an index into the type space. */
export type ValType = PrimValType | { ref: number };

export interface LabelValType {
  label: string;
  type: ValType;
}

export interface VariantCase {
  label: string;
  type?: ValType;
}

export type DefValType =
  | PrimValType
  | { kind: "record"; fields: LabelValType[] }
  | { kind: "variant"; cases: VariantCase[] }
  | { kind: "list"; element: ValType; length?: number }
  | { kind: "tuple"; elements: ValType[] }
  | { kind: "flags"; labels: string[] }
  | { kind: "enum"; labels: string[] }
  | { kind: "option"; type: ValType }
  | { kind: "result"; ok?: ValType; error?: ValType }
  | { kind: "own"; resource: number }
  | { kind: "borrow"; resource: number }
  | { kind: "stream"; element?: ValType }
  | { kind: "future"; element?: ValType }
  | { kind: "map"; key: ValType; value: ValType };

export interface FuncType {
  kind: "func";
  async: boolean;
  params: LabelValType[];
  result?: ValType;
}

export interface ResourceType {
  kind: "resource";
  rep: ValType;
  dtor?: number;
}

export interface ComponentType {
  kind: "component";
  declarations: ComponentDecl[];
}

export interface InstanceType {
  kind: "instance";
  declarations: InstanceDecl[];
}

export type DefType =
  | { kind: "defvaltype"; type: DefValType }
  | FuncType
  | ComponentType
  | InstanceType
  | ResourceType;

/* ------------------------------------------------------------------ */
/* Component/instance type declarations                                */
/* ------------------------------------------------------------------ */

export type InstanceDecl =
  | { kind: "core-type"; type: CoreType }
  | { kind: "type"; type: DefType }
  | { kind: "alias"; alias: Alias }
  | { kind: "export"; name: ExternName; type: ExternType };

export type ComponentDecl =
  | InstanceDecl
  | { kind: "import"; name: ExternName; type: ExternType };

export type ExternType =
  | { kind: "core-module"; typeIdx: number }
  | { kind: "func"; typeIdx: number }
  | { kind: "value"; bound: ValueBound }
  | { kind: "type"; bound: TypeBound }
  | { kind: "component"; typeIdx: number }
  | { kind: "instance"; typeIdx: number };

export type TypeBound =
  | { kind: "eq"; typeIdx: number }
  | { kind: "sub-resource" };

export type ValueBound =
  | { kind: "eq"; valueIdx: number }
  | { kind: "type"; type: ValType };

/** Import/export name plus optional 🏷️/🔗 attributes. */
export interface ExternName {
  name: string;
  attributes?: NameAttribute[];
}

export type NameAttribute =
  | { kind: "implements"; interface: string }
  | { kind: "versionsuffix"; suffix: string }
  | { kind: "external-id"; name: string };

/* ------------------------------------------------------------------ */
/* Core types (module types etc.)                                      */
/* ------------------------------------------------------------------ */

/**
 * Core types appearing in the component's core:type section. A runtime
 * mostly needs module types (for import/export checking); other core
 * types are parsed structurally but not interpreted.
 */
export type CoreType =
  | { kind: "module"; declarations: CoreModuleDecl[] }
  | { kind: "func"; params: string[]; results: string[] }
  | { kind: "other" };

export type CoreModuleDecl =
  | {
      kind: "import";
      module: string;
      name: string;
      type: CoreExternType;
    }
  | { kind: "type"; type: CoreType }
  | { kind: "alias-outer-type"; count: number; typeIdx: number }
  | { kind: "export"; name: string; type: CoreExternType };

export type CoreExternType =
  | { kind: "func"; typeIdx: number }
  | {
      kind: "table";
      refType: string;
      limits: CoreLimits;
    }
  | { kind: "memory"; limits: CoreLimits }
  | {
      kind: "global";
      valType: string;
      mutable: boolean;
    }
  | { kind: "tag"; typeIdx: number };

export interface CoreLimits {
  min: number | bigint;
  max?: number | bigint;
  shared: boolean;
  memory64: boolean;
}

/* ------------------------------------------------------------------ */
/* Instance expressions                                                */
/* ------------------------------------------------------------------ */

export type CoreInstanceExpr =
  | {
      kind: "instantiate";
      moduleIdx: number;
      args: { name: string; instanceIdx: number }[];
    }
  | {
      kind: "exports";
      exports: { name: string; sortIdx: CoreSortIdx }[];
    };

export type InstanceExpr =
  | {
      kind: "instantiate";
      componentIdx: number;
      args: { name: string; sortIdx: SortIdx }[];
    }
  | {
      kind: "exports";
      exports: { name: ExternName; sortIdx: SortIdx }[];
    };

/* ------------------------------------------------------------------ */
/* Aliases                                                             */
/* ------------------------------------------------------------------ */

export type Alias =
  | { kind: "export"; sort: Sort; instanceIdx: number; name: string }
  | { kind: "core-export"; sort: Sort; instanceIdx: number; name: string }
  | { kind: "outer"; sort: Sort; count: number; idx: number };

/* ------------------------------------------------------------------ */
/* Canonical definitions                                               */
/* ------------------------------------------------------------------ */

export type StringEncoding = "utf8" | "utf16" | "latin1+utf16";

export interface CanonicalOptions {
  stringEncoding: StringEncoding;
  memoryIdx?: number;
  reallocIdx?: number;
  postReturnIdx?: number;
  async: boolean;
  callbackIdx?: number;
}

export type Canon =
  | {
      kind: "lift";
      coreFuncIdx: number;
      options: CanonicalOptions;
      typeIdx: number;
    }
  | { kind: "lower"; funcIdx: number; options: CanonicalOptions }
  | { kind: "resource.new"; typeIdx: number }
  | { kind: "resource.drop"; typeIdx: number }
  | { kind: "resource.rep"; typeIdx: number }
  | { kind: "task.return"; result?: ValType; options: CanonicalOptions }
  | { kind: "task.cancel" }
  | { kind: "backpressure.inc" }
  | { kind: "backpressure.dec" }
  | { kind: "context.get"; type: ValType; slot: number }
  | { kind: "context.set"; type: ValType; slot: number }
  | { kind: "subtask.cancel"; async: boolean }
  | { kind: "subtask.drop" }
  | { kind: "stream.new"; typeIdx: number }
  | { kind: "stream.read"; typeIdx: number; options: CanonicalOptions }
  | { kind: "stream.write"; typeIdx: number; options: CanonicalOptions }
  | { kind: "stream.cancel-read"; typeIdx: number; async: boolean }
  | { kind: "stream.cancel-write"; typeIdx: number; async: boolean }
  | { kind: "stream.drop-readable"; typeIdx: number }
  | { kind: "stream.drop-writable"; typeIdx: number }
  | { kind: "future.new"; typeIdx: number }
  | { kind: "future.read"; typeIdx: number; options: CanonicalOptions }
  | { kind: "future.write"; typeIdx: number; options: CanonicalOptions }
  | { kind: "future.cancel-read"; typeIdx: number; async: boolean }
  | { kind: "future.cancel-write"; typeIdx: number; async: boolean }
  | { kind: "future.drop-readable"; typeIdx: number }
  | { kind: "future.drop-writable"; typeIdx: number }
  | { kind: "error-context.new"; options: CanonicalOptions }
  | { kind: "error-context.debug-message"; options: CanonicalOptions }
  | { kind: "error-context.drop" }
  | { kind: "waitable-set.new" }
  | { kind: "waitable-set.wait"; cancellable: boolean; memoryIdx: number }
  | { kind: "waitable-set.poll"; cancellable: boolean; memoryIdx: number }
  | { kind: "waitable-set.drop" }
  | { kind: "waitable.join" }
  | { kind: "thread.yield"; cancellable: boolean };

/* ------------------------------------------------------------------ */
/* Values (🪙)                                                         */
/* ------------------------------------------------------------------ */

export interface ValueDef {
  type: ValType;
  /** Raw bytes of val(t); decoded lazily against the resolved type. */
  bytes: Uint8Array;
}

/* ------------------------------------------------------------------ */
/* Definitions and the component                                       */
/* ------------------------------------------------------------------ */

export type Definition =
  | {
      kind: "core-module";
      /** Byte range of the full core module binary in the input buffer. */
      offset: number;
      length: number;
    }
  | { kind: "core-instance"; expr: CoreInstanceExpr }
  | { kind: "core-type"; type: CoreType }
  | { kind: "component"; component: ParsedComponent }
  | { kind: "instance"; expr: InstanceExpr }
  | { kind: "alias"; alias: Alias }
  | { kind: "type"; type: DefType }
  | { kind: "canon"; canon: Canon }
  | { kind: "start"; funcIdx: number; args: number[]; results: number }
  | { kind: "import"; name: ExternName; type: ExternType }
  | { kind: "export"; name: ExternName; sortIdx: SortIdx; type?: ExternType }
  | { kind: "value"; value: ValueDef }
  | { kind: "custom"; name: string; offset: number; length: number };

export interface ParsedComponent {
  /** The full binary the byte ranges in definitions refer to. */
  bytes: Uint8Array;
  /** Binary format version from the preamble (currently 0x0d). */
  version: number;
  definitions: Definition[];
}
