import { parseComponent, isComponent } from "./parser/parser.ts";
import {
  buildExportsObject,
  linkComponent,
  rawHostValue,
  type Entity,
} from "./runtime/linker.ts";
import type { ParsedComponent } from "./parser/ast.ts";

export { parseComponent, isComponent };
export { ParseError } from "./parser/reader.ts";
export {
  ComponentError,
  ComponentTrap,
  UnsupportedFeatureError,
} from "./runtime/errors.ts";
export { GuestResource } from "./runtime/canonical.ts";
export type * from "./parser/ast.ts";

export interface ComponentInstance {
  /**
   * The component's exports as JS values: functions for exported
   * functions, nested objects for exported instances/interfaces.
   * Kebab-case export names also get camelCase aliases (jco convention).
   */
  exports: Record<string, unknown>;
}

/**
 * Imports for instantiating a component, keyed by import name (e.g.
 * "wasi:cli/environment@0.2.0" — the version suffix may be omitted).
 * Function imports are JS functions, instance imports are objects whose
 * members follow jco conventions (camelCase functions, PascalCase
 * resource classes).
 */
export type ComponentImports = Record<string, unknown>;

/**
 * Instantiates a WebAssembly Component Model binary and returns its
 * exports. The binary is decomposed into its core modules which are
 * compiled and instantiated with the JavaScript WebAssembly API — no
 * ahead-of-time transpilation required.
 */
export async function instantiateComponent(
  bytes: Uint8Array | ArrayBuffer,
  imports: ComponentImports = {},
): Promise<ComponentInstance> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const parsed = parseComponent(data);
  return instantiateParsedComponent(parsed, imports);
}

/**
 * Instantiates an already-parsed component (see {@link parseComponent}).
 */
export async function instantiateParsedComponent(
  parsed: ParsedComponent,
  imports: ComponentImports = {},
): Promise<ComponentInstance> {
  const args = new Map<string, Entity>();
  for (const [name, value] of Object.entries(imports)) {
    args.set(name, rawHostValue(value));
  }
  const scope = await linkComponent(parsed, args);
  return { exports: buildExportsObject(scope) };
}
