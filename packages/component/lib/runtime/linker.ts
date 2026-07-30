/**
 * The linker: walks a parsed component's definitions in order, building the
 * core and component index spaces, instantiating core modules with the
 * browser's WebAssembly API, and creating canonical-ABI trampolines for
 * lifted and lowered functions.
 *
 * Follows the instantiation semantics in design/mvp/Explainer.md.
 */

import type {
  Alias,
  Canon,
  CanonicalOptions,
  CoreType,
  DefType,
  DefValType,
  Definition,
  ExternName,
  ExternType,
  InstanceDecl,
  ParsedComponent,
  SortIdx,
  ValType,
} from "../parser/ast.ts";
import {
  type CanonContext,
  CoreValueIter,
  GuestResource,
  HostResourceTable,
  liftFlatValues,
  lowerFlatValues,
  type FlatValue,
  type InstanceState,
} from "./canonical.ts";
import {
  ComponentError,
  ComponentTrap,
  UnsupportedFeatureError,
  trap,
  trapIf,
} from "./errors.ts";
import { CallScope, ResourceHandle, Table } from "./resources.ts";
import {
  MAX_FLAT_PARAMS,
  MAX_FLAT_RESULTS,
  flattenTypes,
  toCamelCase,
  toPascalCase,
  type RT,
  type RTFunc,
  type RTResource,
} from "./types.ts";

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

export interface ComponentFunc {
  type: RTFunc;
  /**
   * JS-convention callable: result-typed functions return the ok payload
   * and throw ComponentError for the error case.
   */
  call: (args: unknown[]) => unknown;
}

export type TypeEntity =
  | { kind: "val"; rt: RT }
  | { kind: "func"; ft: RTFunc }
  | { kind: "resource"; resource: RTResource }
  | { kind: "component-type"; decl: DefType; scope: Scope | DeclScope }
  | { kind: "instance-type"; decl: DefType; scope: Scope | DeclScope };

export interface InstanceEntity {
  exports: Map<string, Entity>;
}

export interface ComponentClosure {
  parsed: ParsedComponent;
  parentScope?: Scope;
}

export type Entity =
  | { kind: "func"; func: ComponentFunc }
  | { kind: "type"; type: TypeEntity }
  | { kind: "instance"; instance: InstanceEntity }
  | { kind: "component"; component: ComponentClosure }
  | { kind: "value"; type: RT; value: unknown }
  | { kind: "core-module"; module: CoreModuleSlot };

export interface CoreModuleSlot {
  bytes: Uint8Array;
  compiled?: Promise<WebAssembly.Module>;
}

interface CoreInstanceHandle {
  exports: Record<string, WebAssembly.ExportValue>;
}

/* ------------------------------------------------------------------ */
/* Scopes                                                              */
/* ------------------------------------------------------------------ */

export interface Scope {
  core: {
    funcs: CallableFunction[];
    tables: WebAssembly.Table[];
    memories: WebAssembly.Memory[];
    globals: WebAssembly.Global[];
    tags: unknown[];
    types: CoreType[];
    modules: CoreModuleSlot[];
    instances: CoreInstanceHandle[];
  };
  funcs: ComponentFunc[];
  values: { type: RT; value: unknown }[];
  types: TypeEntity[];
  components: ComponentClosure[];
  instances: InstanceEntity[];
  parent?: Scope;
  state: InstanceState;
  exports: Map<string, Entity>;
}

function newScope(parent?: Scope): Scope {
  return {
    core: {
      funcs: [],
      tables: [],
      memories: [],
      globals: [],
      tags: [],
      types: [],
      modules: [],
      instances: [],
    },
    funcs: [],
    values: [],
    types: [],
    components: [],
    instances: [],
    parent,
    state: { handles: new Table<ResourceHandle>(), mayLeave: true },
    exports: new Map(),
  };
}

/**
 * A lightweight scope for walking the declarations inside component and
 * instance types. Only the type and instance index spaces are populated —
 * that is all declarations can refer to.
 */
interface DeclScope {
  types: TypeEntity[];
  instances: { exportedTypes: Map<string, TypeEntity> }[];
  parent?: Scope | DeclScope;
}

/* ------------------------------------------------------------------ */
/* Type resolution                                                     */
/* ------------------------------------------------------------------ */

function resolveValType(scope: Scope | DeclScope, t: ValType): RT {
  if (typeof t === "string") {
    if (t === "error-context") {
      return { k: "error-context" };
    }
    return { k: t } as RT;
  }
  const entity = scope.types[t.ref];
  trapIf(entity === undefined, `type index ${t.ref} out of range`);
  if (entity.kind === "val") {
    return entity.rt;
  }
  if (entity.kind === "resource") {
    // A bare typeidx naming a resource appears inside own<T>/borrow<T>;
    // resolveDefValType handles those directly. Anywhere else is invalid.
    trap(`resource type used directly as a value type`);
  }
  trap(`type index ${t.ref} is not a value type`);
}

function resolveResource(scope: Scope | DeclScope, idx: number): RTResource {
  const entity = scope.types[idx];
  trapIf(entity === undefined, `type index ${idx} out of range`);
  if (entity.kind === "resource") {
    return entity.resource;
  }
  trap(`type index ${idx} is not a resource type`);
}

function resolveDefValType(scope: Scope | DeclScope, t: DefValType): RT {
  if (typeof t === "string") {
    if (t === "error-context") {
      return { k: "error-context" };
    }
    return { k: t } as RT;
  }
  switch (t.kind) {
    case "record":
      return {
        k: "record",
        fields: t.fields.map((f) => ({
          label: f.label,
          camel: toCamelCase(f.label),
          type: resolveValType(scope, f.type),
        })),
      };
    case "variant":
      return {
        k: "variant",
        cases: t.cases.map((c) => ({
          label: c.label,
          type:
            c.type === undefined ? undefined : resolveValType(scope, c.type),
        })),
      };
    case "list":
      return {
        k: "list",
        element: resolveValType(scope, t.element),
        length: t.length,
      };
    case "tuple":
      return {
        k: "tuple",
        elements: t.elements.map((el) => resolveValType(scope, el)),
      };
    case "flags":
      return {
        k: "flags",
        labels: t.labels,
        camels: t.labels.map(toCamelCase),
      };
    case "enum":
      return { k: "enum", labels: t.labels };
    case "option":
      return { k: "option", type: resolveValType(scope, t.type) };
    case "result":
      return {
        k: "result",
        ok: t.ok === undefined ? undefined : resolveValType(scope, t.ok),
        error:
          t.error === undefined ? undefined : resolveValType(scope, t.error),
      };
    case "own":
      return { k: "own", resource: resolveResource(scope, t.resource) };
    case "borrow":
      return { k: "borrow", resource: resolveResource(scope, t.resource) };
    case "stream":
      return {
        k: "stream",
        element:
          t.element === undefined
            ? undefined
            : resolveValType(scope, t.element),
      };
    case "future":
      return {
        k: "future",
        element:
          t.element === undefined
            ? undefined
            : resolveValType(scope, t.element),
      };
    case "map":
      return {
        k: "map",
        key: resolveValType(scope, t.key),
        value: resolveValType(scope, t.value),
      };
  }
}

function resolveFuncType(
  scope: Scope | DeclScope,
  t: DefType & { kind: "func" },
): RTFunc {
  return {
    async: t.async,
    params: t.params.map((p) => ({
      label: p.label,
      type: resolveValType(scope, p.type),
    })),
    result:
      t.result === undefined ? undefined : resolveValType(scope, t.result),
  };
}

function resolveTypeDef(
  scope: Scope | DeclScope,
  t: DefType,
  makeResource: (rep: RT, dtor?: number) => RTResource,
): TypeEntity {
  switch (t.kind) {
    case "defvaltype":
      return { kind: "val", rt: resolveDefValType(scope, t.type) };
    case "func":
      return { kind: "func", ft: resolveFuncType(scope, t) };
    case "resource": {
      const rep = resolveValType(scope, t.rep);
      return { kind: "resource", resource: makeResource(rep, t.dtor) };
    }
    case "component":
      return { kind: "component-type", decl: t, scope };
    case "instance":
      return { kind: "instance-type", decl: t, scope };
  }
}

function funcTypeFromEntity(entity: TypeEntity): RTFunc {
  trapIf(entity.kind !== "func", "expected a function type");
  return (entity as { kind: "func"; ft: RTFunc }).ft;
}

/* ------------------------------------------------------------------ */
/* Canonical function builders                                          */
/* ------------------------------------------------------------------ */

function makeCanonContext(
  scope: Scope,
  options: CanonicalOptions,
): CanonContext {
  return {
    memory: () => {
      const memory = scope.core.memories[options.memoryIdx ?? -1];
      trapIf(memory === undefined, "canonical option memory is missing");
      return memory;
    },
    realloc:
      options.reallocIdx === undefined
        ? undefined
        : () => {
            const realloc = scope.core.funcs[options.reallocIdx!];
            trapIf(
              realloc === undefined,
              "canonical option realloc is missing",
            );
            return realloc as (
              oldPtr: number,
              oldSize: number,
              align: number,
              newSize: number,
            ) => number;
          },
    stringEncoding: options.stringEncoding,
    inst: scope.state,
  };
}

/** canon lift: core function -> component function (JS convention). */
function canonLift(
  scope: Scope,
  canon: Canon & { kind: "lift" },
): ComponentFunc {
  trapIf(
    canon.options.async,
    "async canon lift is not supported yet (WASI 0.3 components)",
  );
  const ft = funcTypeFromEntity(scope.types[canon.typeIdx]);
  const coreFunc = scope.core.funcs[canon.coreFuncIdx];
  trapIf(coreFunc === undefined, `core func ${canon.coreFuncIdx} out of range`);
  const baseCx = makeCanonContext(scope, canon.options);

  const call = (args: unknown[]): unknown => {
    trapIf(!scope.state.mayLeave, "cannot reenter component during a call");
    const cx: CanonContext = { ...baseCx, scope: new CallScope() };
    const paramTypes = ft.params.map((p) => p.type);
    const flatArgs = lowerFlatValues(cx, MAX_FLAT_PARAMS, args, paramTypes);
    const rawResult = (coreFunc as (...a: FlatValue[]) => FlatValue | void)(
      ...flatArgs,
    );
    let result: unknown;
    if (ft.result !== undefined) {
      const flatResults: FlatValue[] =
        rawResult === undefined ? [] : [rawResult as FlatValue];
      const [lifted] = liftFlatValues(
        cx,
        MAX_FLAT_RESULTS,
        new CoreValueIter(flatResults),
        [ft.result],
      );
      result = lifted;
    }
    if (canon.options.postReturnIdx !== undefined) {
      const postReturn = scope.core.funcs[canon.options.postReturnIdx];
      trapIf(postReturn === undefined, "post-return function is missing");
      if (rawResult === undefined) {
        (postReturn as () => void)();
      } else {
        (postReturn as (v: FlatValue) => void)(rawResult as FlatValue);
      }
    }
    cx.scope!.exit();
    return unwrapResult(ft, result);
  };

  return { type: ft, call };
}

/** Unwrap a result-typed return at the JS boundary: ok -> value, err -> throw. */
function unwrapResult(ft: RTFunc, result: unknown): unknown {
  if (ft.result?.k === "result") {
    const tagged = result as { tag: string; val?: unknown };
    if (tagged.tag === "err") {
      throw new ComponentError(tagged.val);
    }
    return tagged.val;
  }
  return result;
}

/** Wrap a thrown error back into a result value at the JS boundary. */
function wrapResult(ft: RTFunc, fn: () => unknown): unknown {
  if (ft.result?.k === "result") {
    try {
      return { tag: "ok", val: fn() };
    } catch (e) {
      if (e instanceof ComponentTrap) {
        throw e;
      }
      if (e instanceof ComponentError) {
        return { tag: "err", val: e.payload };
      }
      const errorType = ft.result.error;
      if (errorType?.k === "string") {
        return { tag: "err", val: String((e as Error)?.message ?? e) };
      }
      if (errorType === undefined) {
        return { tag: "err", val: undefined };
      }
      // The host threw a payload-shaped error; try lowering it directly.
      return { tag: "err", val: e };
    }
  }
  return fn();
}

/** canon lower: component function -> core function trampoline. */
function canonLower(
  scope: Scope,
  canon: Canon & { kind: "lower" },
): CallableFunction {
  trapIf(canon.options.async, "async canon lower is not supported yet");
  const func = scope.funcs[canon.funcIdx];
  trapIf(func === undefined, `component func ${canon.funcIdx} out of range`);
  const baseCx = makeCanonContext(scope, canon.options);
  const ft = func.type;
  const paramTypes = ft.params.map((p) => p.type);
  const resultTypes = ft.result === undefined ? [] : [ft.result];
  const flatResultCount = flattenTypes(resultTypes).length;

  return (...flatArgs: FlatValue[]): FlatValue | undefined => {
    const cx: CanonContext = { ...baseCx, scope: new CallScope() };
    const spillResults = flatResultCount > MAX_FLAT_RESULTS;
    const argValues = flatArgs.slice(
      0,
      spillResults ? flatArgs.length - 1 : flatArgs.length,
    );
    const args = liftFlatValues(
      cx,
      MAX_FLAT_PARAMS,
      new CoreValueIter(argValues),
      paramTypes,
    );
    const resultValue = wrapResult(ft, () => func.call(args));
    let flat: FlatValue[] = [];
    if (ft.result !== undefined) {
      const outPtr = spillResults
        ? Number(flatArgs[flatArgs.length - 1]) >>> 0
        : undefined;
      flat = lowerFlatValues(
        cx,
        MAX_FLAT_RESULTS,
        [ft.result.k === "result" ? rewrapResult(resultValue) : resultValue],
        resultTypes,
        outPtr,
      );
    }
    cx.scope!.exit();
    trapIf(flat.length > 1, "unexpected multi-value core result");
    return flat.length === 1 ? flat[0] : undefined;
  };
}

/**
 * wrapResult produced a {tag,val} object for result types; pass through.
 */
function rewrapResult(v: unknown): unknown {
  return v;
}

/* ------------------------------------------------------------------ */
/* Resource builtins                                                   */
/* ------------------------------------------------------------------ */

function resourceNew(scope: Scope, resource: RTResource): CallableFunction {
  return (rep: number): number => {
    return scope.state.handles.add(
      new ResourceHandle(resource, rep >>> 0, true),
    );
  };
}

function resourceDrop(scope: Scope, resource: RTResource): CallableFunction {
  return (i: number): void => {
    const h = scope.state.handles.remove(i >>> 0);
    trapIf(h.rt !== resource, "resource.drop on wrong resource type");
    trapIf(h.numLends !== 0, "cannot drop a lent handle");
    if (h.own) {
      resource.dtor?.(h.rep);
    } else if (h.borrowScope) {
      h.borrowScope.numBorrows--;
    }
  };
}

function resourceRep(scope: Scope, resource: RTResource): CallableFunction {
  return (i: number): number => {
    const h = scope.state.handles.get(i >>> 0);
    trapIf(h.rt !== resource, "resource.rep on wrong resource type");
    return h.rep;
  };
}

/* ------------------------------------------------------------------ */
/* Host import binding                                                  */
/* ------------------------------------------------------------------ */

/**
 * Wraps a host-supplied JS value into an entity matching the declared
 * extern type of an import.
 */
function bindImport(
  scope: Scope,
  name: ExternName,
  externType: ExternType,
  value: unknown,
): Entity {
  switch (externType.kind) {
    case "func": {
      const ft = funcTypeFromEntity(scope.types[externType.typeIdx]);
      trapIf(
        typeof value !== "function",
        `import "${name.name}" must be a function`,
      );
      return {
        kind: "func",
        func: { type: ft, call: (args) => (value as Function)(...args) },
      };
    }
    case "instance": {
      const entity = scope.types[externType.typeIdx];
      trapIf(
        entity?.kind !== "instance-type",
        `import "${name.name}" type index is not an instance type`,
      );
      const decl = (entity as { decl: DefType & { kind: "instance" } }).decl;
      const declScope = (entity as { scope: Scope | DeclScope }).scope;
      return {
        kind: "instance",
        instance: bindHostInstance(
          name.name,
          decl.declarations,
          declScope,
          value,
        ),
      };
    }
    case "type": {
      if (externType.bound.kind === "sub-resource") {
        return {
          kind: "type",
          type: {
            kind: "resource",
            resource: makeHostResource(name.name, value),
          },
        };
      }
      const target = scope.types[externType.bound.typeIdx];
      trapIf(target === undefined, "type bound out of range");
      return { kind: "type", type: target };
    }
    case "value": {
      const type =
        externType.bound.kind === "type"
          ? resolveValType(scope, externType.bound.type)
          : scope.values[externType.bound.valueIdx]?.type;
      trapIf(type === undefined, "value bound out of range");
      return { kind: "value", type, value };
    }
    case "component":
      trapIf(
        typeof value !== "object" || value === null || !("parsed" in value),
        `import "${name.name}" must be a component`,
      );
      return { kind: "component", component: value as ComponentClosure };
    case "core-module":
      trap("core module imports from the host are not supported yet");
  }
}

function makeHostResource(name: string, hostClass: unknown): RTResource {
  const hosted = new HostResourceTable();
  const resource: RTResource = {
    name,
    hosted,
    hostClass,
  };
  resource.dtor = (rep: number) => {
    const obj = hosted.release(rep) as {
      [Symbol.dispose]?: () => void;
    } | null;
    obj?.[Symbol.dispose]?.();
  };
  return resource;
}

const METHOD_PREFIX = "[method]";
const STATIC_PREFIX = "[static]";
const CONSTRUCTOR_PREFIX = "[constructor]";

/**
 * Binds a host-supplied JS object to an instance type declaration,
 * producing the instance entity. Resource types exported by the instance
 * become host resources whose methods dispatch onto the JS objects
 * (jco/preview2-shim conventions).
 */
function bindHostInstance(
  instanceName: string,
  declarations: InstanceDecl[],
  outerScope: Scope | DeclScope,
  hostValue: unknown,
): InstanceEntity {
  const obj = (hostValue ?? {}) as Record<string, unknown>;
  const declScope: DeclScope = { types: [], instances: [], parent: outerScope };
  const exports = new Map<string, Entity>();
  const resourcesByName = new Map<string, RTResource>();

  for (const decl of declarations) {
    switch (decl.kind) {
      case "core-type":
        break;
      case "type": {
        const entity = resolveTypeDef(declScope, decl.type, () => {
          trap("resource type definitions are not allowed in instance types");
        });
        declScope.types.push(entity);
        break;
      }
      case "alias": {
        declScope.types.push(resolveDeclAlias(declScope, decl.alias));
        break;
      }
      case "export": {
        const name = decl.name.name;
        const entity = bindHostExport(
          instanceName,
          name,
          decl.type,
          declScope,
          obj,
          resourcesByName,
        );
        exports.set(name, entity);
        // Exports introduce a new type index when they are types.
        if (entity.kind === "type") {
          declScope.types.push(entity.type);
        }
        break;
      }
    }
  }
  return { exports };
}

function resolveDeclAlias(scope: DeclScope, alias: Alias): TypeEntity {
  if (alias.kind === "outer") {
    let target: Scope | DeclScope | undefined = scope;
    for (let i = 0; i < alias.count; i++) {
      target = target?.parent;
    }
    trapIf(target === undefined, "outer alias out of range");
    const entity = target!.types[alias.idx];
    trapIf(entity === undefined, "outer alias type index out of range");
    return entity;
  }
  trap(`${alias.kind} aliases inside instance types are not supported yet`);
}

function bindHostExport(
  instanceName: string,
  name: string,
  externType: ExternType,
  declScope: DeclScope,
  obj: Record<string, unknown>,
  resourcesByName: Map<string, RTResource>,
): Entity {
  switch (externType.kind) {
    case "type": {
      if (externType.bound.kind === "sub-resource") {
        const className = toPascalCase(name);
        const hostClass = obj[className] ?? obj[toCamelCase(name)];
        const resource = makeHostResource(`${instanceName}#${name}`, hostClass);
        resourcesByName.set(name, resource);
        return { kind: "type", type: { kind: "resource", resource } };
      }
      const target = declScope.types[externType.bound.typeIdx];
      trapIf(target === undefined, "type bound out of range");
      return { kind: "type", type: target };
    }
    case "func": {
      const entity = declScope.types[externType.typeIdx];
      const ft = funcTypeFromEntity(entity);
      const impl = hostFunctionFor(name, obj, resourcesByName);
      return {
        kind: "func",
        func: { type: ft, call: (args) => impl(...args) },
      };
    }
    case "instance": {
      const entity = declScope.types[externType.typeIdx];
      trapIf(entity?.kind !== "instance-type", "expected instance type");
      const decl = (entity as { decl: DefType & { kind: "instance" } }).decl;
      const scope = (entity as { scope: Scope | DeclScope }).scope;
      return {
        kind: "instance",
        instance: bindHostInstance(
          `${instanceName}/${name}`,
          decl.declarations,
          scope,
          obj[name] ?? obj[toCamelCase(name)],
        ),
      };
    }
    default:
      trap(`unsupported host instance export kind: ${externType.kind}`);
  }
}

/**
 * Resolves the JS implementation for a named function export of a host
 * instance, applying jco resource-method conventions.
 */
function hostFunctionFor(
  name: string,
  obj: Record<string, unknown>,
  resources: Map<string, RTResource>,
): (...args: unknown[]) => unknown {
  if (name.startsWith(METHOD_PREFIX)) {
    const [resourceName, methodName] = name
      .slice(METHOD_PREFIX.length)
      .split(".", 2);
    const method = toCamelCase(methodName);
    void resources.get(resourceName);
    return (self, ...rest) => {
      const target = self as Record<string, (...a: unknown[]) => unknown>;
      trapIf(
        typeof target?.[method] !== "function",
        `host resource ${resourceName} has no method ${method}`,
      );
      return target[method](...rest);
    };
  }
  if (name.startsWith(STATIC_PREFIX)) {
    const [resourceName, methodName] = name
      .slice(STATIC_PREFIX.length)
      .split(".", 2);
    const method = toCamelCase(methodName);
    return (...args) => {
      const cls = resources.get(resourceName)?.hostClass as Record<
        string,
        (...a: unknown[]) => unknown
      >;
      trapIf(
        typeof cls?.[method] !== "function",
        `host resource ${resourceName} has no static ${method}`,
      );
      return cls[method](...args);
    };
  }
  if (name.startsWith(CONSTRUCTOR_PREFIX)) {
    const resourceName = name.slice(CONSTRUCTOR_PREFIX.length);
    return (...args) => {
      const cls = resources.get(resourceName)?.hostClass as new (
        ...a: unknown[]
      ) => unknown;
      trapIf(
        typeof cls !== "function",
        `host resource ${resourceName} has no constructor`,
      );
      return new cls(...args);
    };
  }
  const impl = obj[toCamelCase(name)] ?? obj[name];
  trapIf(
    typeof impl !== "function",
    `host instance is missing function "${name}"`,
  );
  return impl as (...args: unknown[]) => unknown;
}

/* ------------------------------------------------------------------ */
/* The definition walk                                                 */
/* ------------------------------------------------------------------ */

export async function linkComponent(
  parsed: ParsedComponent,
  args: Map<string, Entity>,
  parentScope?: Scope,
): Promise<Scope> {
  const scope = newScope(parentScope);

  for (const definition of parsed.definitions) {
    await evaluateDefinition(parsed, scope, definition, args);
  }
  return scope;
}

async function evaluateDefinition(
  parsed: ParsedComponent,
  scope: Scope,
  definition: Definition,
  args: Map<string, Entity>,
): Promise<void> {
  switch (definition.kind) {
    case "custom":
      return;

    case "core-module": {
      scope.core.modules.push({
        bytes: parsed.bytes.subarray(
          definition.offset,
          definition.offset + definition.length,
        ),
      });
      return;
    }

    case "core-instance": {
      const expr = definition.expr;
      if (expr.kind === "instantiate") {
        const slot = scope.core.modules[expr.moduleIdx];
        trapIf(
          slot === undefined,
          `core module ${expr.moduleIdx} out of range`,
        );
        slot.compiled ??= WebAssembly.compile(
          slot.bytes.slice().buffer as ArrayBuffer,
        );
        const module = await slot.compiled;
        const imports: Record<string, Record<string, unknown>> = {};
        for (const arg of expr.args) {
          const instance = scope.core.instances[arg.instanceIdx];
          trapIf(
            instance === undefined,
            `core instance ${arg.instanceIdx} out of range`,
          );
          imports[arg.name] = instance.exports;
        }
        const instance = await WebAssembly.instantiate(
          module,
          imports as WebAssembly.Imports,
        );
        scope.core.instances.push({
          exports: instance.exports as Record<string, WebAssembly.ExportValue>,
        });
      } else {
        const exports: Record<string, WebAssembly.ExportValue> = {};
        for (const e of expr.exports) {
          exports[e.name] = coreSortValue(scope, e.sortIdx.sort, e.sortIdx.idx);
        }
        scope.core.instances.push({ exports });
      }
      return;
    }

    case "core-type":
      scope.core.types.push(definition.type);
      return;

    case "component":
      scope.components.push({
        parsed: definition.component,
        parentScope: scope,
      });
      return;

    case "instance": {
      const expr = definition.expr;
      if (expr.kind === "instantiate") {
        const closure = scope.components[expr.componentIdx];
        trapIf(
          closure === undefined,
          `component ${expr.componentIdx} out of range`,
        );
        const instanceArgs = new Map<string, Entity>();
        for (const arg of expr.args) {
          instanceArgs.set(arg.name, entityFromSortIdx(scope, arg.sortIdx));
        }
        const inner = await linkComponent(
          closure.parsed,
          instanceArgs,
          closure.parentScope,
        );
        scope.instances.push({ exports: inner.exports });
      } else {
        const exports = new Map<string, Entity>();
        for (const e of expr.exports) {
          exports.set(e.name.name, entityFromSortIdx(scope, e.sortIdx));
        }
        scope.instances.push({ exports });
      }
      return;
    }

    case "alias":
      evaluateAlias(scope, definition.alias);
      return;

    case "type": {
      const entity = resolveTypeDef(scope, definition.type, (rep, dtorIdx) => {
        const resource: RTResource = {
          name: "resource",
          impl: scope.state,
        };
        void rep;
        if (dtorIdx !== undefined) {
          resource.dtor = (repValue: number) => {
            const dtor = scope.core.funcs[dtorIdx];
            trapIf(dtor === undefined, "resource destructor is missing");
            (dtor as (rep: number) => void)(repValue);
          };
        }
        return resource;
      });
      scope.types.push(entity);
      return;
    }

    case "canon": {
      const canon = definition.canon;
      switch (canon.kind) {
        case "lift":
          scope.funcs.push(canonLift(scope, canon));
          return;
        case "lower":
          scope.core.funcs.push(canonLower(scope, canon));
          return;
        case "resource.new": {
          const resource = resolveResource(scope, canon.typeIdx);
          scope.core.funcs.push(resourceNew(scope, resource));
          return;
        }
        case "resource.drop": {
          const resource = resolveResource(scope, canon.typeIdx);
          scope.core.funcs.push(resourceDrop(scope, resource));
          return;
        }
        case "resource.rep": {
          const resource = resolveResource(scope, canon.typeIdx);
          scope.core.funcs.push(resourceRep(scope, resource));
          return;
        }
        default:
          throw new UnsupportedFeatureError(`canon ${canon.kind}`);
      }
    }

    case "start": {
      const func = scope.funcs[definition.funcIdx];
      trapIf(func === undefined, "start function out of range");
      const argValues = definition.args.map((i) => {
        const v = scope.values[i];
        trapIf(v === undefined, "start argument out of range");
        return v.value;
      });
      const result = func.call(argValues);
      if (definition.results === 1 && func.type.result !== undefined) {
        scope.values.push({ type: func.type.result, value: result });
      }
      return;
    }

    case "import": {
      const provided =
        args.get(definition.name.name) ??
        args.get(stripVersion(definition.name.name));
      let entity: Entity;
      if (provided !== undefined && !isRawHostValue(provided)) {
        entity = provided;
      } else {
        const raw =
          provided !== undefined ? unwrapRawHostValue(provided) : undefined;
        if (raw === undefined && definition.type.kind === "type") {
          // Type imports without a host-provided implementation get a
          // fresh (host) resource type or the declared bound.
          entity = bindImport(
            scope,
            definition.name,
            definition.type,
            undefined,
          );
        } else {
          trapIf(
            raw === undefined,
            `missing import: "${definition.name.name}"`,
          );
          entity = bindImport(scope, definition.name, definition.type, raw);
        }
      }
      pushEntity(scope, entity);
      return;
    }

    case "export": {
      const entity = entityFromSortIdx(scope, definition.sortIdx);
      scope.exports.set(definition.name.name, entity);
      pushEntity(scope, entity);
      return;
    }

    case "value":
      throw new UnsupportedFeatureError("value definitions (🪙)");
  }
}

/**
 * Host-provided import values arrive as raw JS values wrapped by the
 * public API so they can be told apart from already-bound entities
 * (which flow through nested component instantiation).
 */
const RAW = Symbol("runno.component.raw-import");

export function rawHostValue(value: unknown): Entity {
  return { kind: "value", type: { k: "bool" }, value: { [RAW]: value } };
}

function isRawHostValue(entity: Entity): boolean {
  return (
    entity.kind === "value" &&
    typeof entity.value === "object" &&
    entity.value !== null &&
    RAW in (entity.value as object)
  );
}

function unwrapRawHostValue(entity: Entity): unknown {
  return (entity as { value: Record<symbol, unknown> }).value[RAW];
}

function stripVersion(name: string): string {
  return name.replace(/@[^@]*$/, "");
}

function pushEntity(scope: Scope, entity: Entity): void {
  switch (entity.kind) {
    case "func":
      scope.funcs.push(entity.func);
      return;
    case "type":
      scope.types.push(entity.type);
      return;
    case "instance":
      scope.instances.push(entity.instance);
      return;
    case "component":
      scope.components.push(entity.component);
      return;
    case "value":
      scope.values.push({
        type: entity.type,
        value: entity.value,
      });
      return;
    case "core-module":
      scope.core.modules.push(entity.module);
      return;
  }
}

function entityFromSortIdx(scope: Scope, sortIdx: SortIdx): Entity {
  const { sort, idx } = sortIdx;
  if (typeof sort === "object") {
    if (sort.core === "module") {
      const module = scope.core.modules[idx];
      trapIf(module === undefined, `core module ${idx} out of range`);
      return { kind: "core-module", module };
    }
    trap(`core sort ${sort.core} cannot be used as a component entity`);
  }
  switch (sort) {
    case "func": {
      const func = scope.funcs[idx];
      trapIf(func === undefined, `func ${idx} out of range`);
      return { kind: "func", func };
    }
    case "type": {
      const type = scope.types[idx];
      trapIf(type === undefined, `type ${idx} out of range`);
      return { kind: "type", type };
    }
    case "component": {
      const component = scope.components[idx];
      trapIf(component === undefined, `component ${idx} out of range`);
      return { kind: "component", component };
    }
    case "instance": {
      const instance = scope.instances[idx];
      trapIf(instance === undefined, `instance ${idx} out of range`);
      return { kind: "instance", instance };
    }
    case "value": {
      const value = scope.values[idx];
      trapIf(value === undefined, `value ${idx} out of range`);
      return { kind: "value", type: value.type, value: value.value };
    }
  }
}

function coreSortValue(
  scope: Scope,
  sort: string,
  idx: number,
): WebAssembly.ExportValue {
  switch (sort) {
    case "func": {
      const func = scope.core.funcs[idx];
      trapIf(func === undefined, `core func ${idx} out of range`);
      return func as unknown as WebAssembly.ExportValue;
    }
    case "table": {
      const table = scope.core.tables[idx];
      trapIf(table === undefined, `core table ${idx} out of range`);
      return table;
    }
    case "memory": {
      const memory = scope.core.memories[idx];
      trapIf(memory === undefined, `core memory ${idx} out of range`);
      return memory;
    }
    case "global": {
      const global = scope.core.globals[idx];
      trapIf(global === undefined, `core global ${idx} out of range`);
      return global;
    }
    default:
      trap(`core sort ${sort} cannot appear in an inline export`);
  }
}

function evaluateAlias(scope: Scope, alias: Alias): void {
  switch (alias.kind) {
    case "core-export": {
      const instance = scope.core.instances[alias.instanceIdx];
      trapIf(
        instance === undefined,
        `core instance ${alias.instanceIdx} out of range`,
      );
      const value = instance.exports[alias.name];
      trapIf(
        value === undefined,
        `core instance has no export "${alias.name}"`,
      );
      const sort =
        typeof alias.sort === "object" ? alias.sort.core : alias.sort;
      switch (sort) {
        case "func":
          scope.core.funcs.push(value as CallableFunction);
          return;
        case "table":
          scope.core.tables.push(value as WebAssembly.Table);
          return;
        case "memory":
          scope.core.memories.push(value as WebAssembly.Memory);
          return;
        case "global":
          scope.core.globals.push(value as WebAssembly.Global);
          return;
        case "tag":
          scope.core.tags.push(value);
          return;
        default:
          trap(`cannot alias core export of sort ${String(sort)}`);
      }
    }
    case "export": {
      const instance = scope.instances[alias.instanceIdx];
      trapIf(
        instance === undefined,
        `instance ${alias.instanceIdx} out of range`,
      );
      const entity = instance.exports.get(alias.name);
      trapIf(entity === undefined, `instance has no export "${alias.name}"`);
      pushEntity(scope, entity!);
      return;
    }
    case "outer": {
      let target: Scope | undefined = scope;
      for (let i = 0; i < alias.count; i++) {
        target = target?.parent;
      }
      trapIf(target === undefined, "outer alias scope out of range");
      const sort =
        typeof alias.sort === "object" ? alias.sort.core : alias.sort;
      if (typeof alias.sort === "object") {
        if (sort === "module") {
          const module = target!.core.modules[alias.idx];
          trapIf(module === undefined, "outer alias core module out of range");
          scope.core.modules.push(module);
          return;
        }
        if (sort === "type") {
          const type = target!.core.types[alias.idx];
          trapIf(type === undefined, "outer alias core type out of range");
          scope.core.types.push(type);
          return;
        }
        trap(`cannot outer-alias core sort ${String(sort)}`);
      }
      switch (sort) {
        case "type": {
          const type = target!.types[alias.idx];
          trapIf(type === undefined, "outer alias type out of range");
          scope.types.push(type);
          return;
        }
        case "component": {
          const component = target!.components[alias.idx];
          trapIf(component === undefined, "outer alias component out of range");
          scope.components.push(component);
          return;
        }
        default:
          trap(`cannot outer-alias sort ${String(sort)}`);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* JS exports view                                                     */
/* ------------------------------------------------------------------ */

/**
 * Builds the user-facing exports object from a linked root scope,
 * applying jco naming conventions (camelCase aliases for plain names).
 */
export function buildExportsObject(scope: Scope): Record<string, unknown> {
  return exportsToObject(scope.exports);
}

function exportsToObject(
  exports: Map<string, Entity>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, entity] of exports) {
    const value = entityToJs(entity);
    if (value === undefined) {
      continue;
    }
    result[name] = value;
    const camel = toCamelCase(name);
    if (camel !== name && !(camel in result) && !name.includes(":")) {
      result[camel] = value;
    }
  }
  return result;
}

function entityToJs(entity: Entity): unknown {
  switch (entity.kind) {
    case "func":
      return (...args: unknown[]) => entity.func.call(args);
    case "instance":
      return exportsToObject(entity.instance.exports);
    case "value":
      return entity.value;
    case "type":
    case "component":
    case "core-module":
      return undefined;
  }
}

export { GuestResource };
