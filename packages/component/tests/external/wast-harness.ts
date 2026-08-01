/**
 * Harness for wast-derived conformance suites (wasmtime's
 * component-model tests, converted with `wasm-tools json-from-wast`).
 *
 * Interprets the JSON command stream: instantiates component binaries
 * and checks assert_return/assert_trap directives against the runtime's
 * JS value conventions.
 *
 * assert_invalid/assert_malformed are recorded but never fail the suite:
 * this runtime is deliberately not a full validator (it trusts
 * `wasm-tools validate`-clean input), and several wasmtime "invalid"
 * cases are host policy rather than spec (e.g. wasmtime refuses
 * root-level component imports, which are spec-legal and supported
 * here).
 */

import {
  instantiateComponent,
  isComponent,
  ComponentError,
  type Entity,
} from "../../lib/main.ts";
import { makeWastHost } from "./wast-host.ts";

interface JsonValue {
  type: string;
  value?: unknown;
}

interface Command {
  type: string;
  line: number;
  name?: string;
  filename?: string;
  instance?: string;
  module?: string;
  action?: {
    type: string;
    module?: string;
    field: string;
    args: JsonValue[];
  };
  expected?: JsonValue[];
  text?: string;
}

/**
 * Suites the runtime passes completely today. exceptions and memory64
 * need engine features (exnref, memory64) that are not yet on by
 * default in Node/all browsers; error-context/async features beyond
 * these are tracked in docs/async.md.
 */
export const EXPECTED_CLEAN = [
  "adapter",
  "aliasing",
  "big-strings",
  "enum_discriminant",
  "enums",
  "error-context-trap-in-post-return",
  "fixed_length_lists",
  "implements",
  "implements-disabled",
  "import",
  "instance",
  "linking",
  "map-types",
  "modules",
  "nested-many-instantiations",
  "nested",
  "resources",
  "restrictions",
  "simple",
  "strings",
  "string-transcode-invalid",
  "tags",
  "trap",
  "types",
];

export interface WastReport {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  failures: string[];
}

/** Converts a wast JSON component value into our JS conventions. */
function jsonToJs(v: JsonValue): unknown {
  switch (v.type) {
    case "bool":
      return v.value as boolean;
    case "u8":
    case "u16":
    case "u32":
    case "s8":
    case "s16":
    case "s32":
      return Number(v.value);
    case "u64":
    case "s64":
      return BigInt(v.value as string);
    case "f32":
    case "f64": {
      const raw = String(v.value);
      if (raw.startsWith("nan")) return NaN;
      // json-from-wast emits floats as decimal strings.
      return Number(raw);
    }
    case "char":
      return v.value as string;
    case "string":
      return v.value as string;
    case "list": {
      const items = (v.value as JsonValue[]).map(jsonToJs);
      // list<u8> lifts to Uint8Array in our conventions.
      const inner = (v.value as JsonValue[])[0];
      if (inner?.type === "u8") {
        return Uint8Array.from(items as number[]);
      }
      return items;
    }
    case "tuple":
      return (v.value as JsonValue[]).map(jsonToJs);
    case "record": {
      const result: Record<string, unknown> = {};
      for (const field of v.value as { name: string; value: JsonValue }[]) {
        result[camelCase(field.name)] = jsonToJs(field.value);
      }
      return result;
    }
    case "variant": {
      const val = v.value as { case: string; payload?: JsonValue };
      return val.payload === undefined
        ? { tag: val.case }
        : { tag: val.case, val: jsonToJs(val.payload) };
    }
    case "enum":
      return v.value as string;
    case "option": {
      const payload = v.value as JsonValue | null | undefined;
      if (payload == null) {
        return undefined;
      }
      if (payload.type === "option") {
        // Nested option uses the tagged form.
        const inner = payload.value as JsonValue | null | undefined;
        return inner == null
          ? { tag: "some", val: undefined }
          : { tag: "some", val: jsonToJs(payload) };
      }
      return jsonToJs(payload);
    }
    case "result": {
      const val = v.value as {
        ok?: JsonValue | null;
        err?: JsonValue | null;
      };
      if ("err" in val) {
        return {
          tag: "err",
          val: val.err == null ? undefined : jsonToJs(val.err),
        };
      }
      return {
        tag: "ok",
        val: val.ok == null ? undefined : jsonToJs(val.ok),
      };
    }
    case "flags": {
      const set = new Set(v.value as string[]);
      const result: Record<string, boolean> = {};
      for (const label of set) {
        result[camelCase(label)] = true;
      }
      return result;
    }
    default:
      throw new Error(`unsupported wast value type: ${v.type}`);
  }
}

function camelCase(label: string): string {
  return label.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

function equalish(actual: unknown, expected: unknown): boolean {
  if (typeof expected === "number" && Number.isNaN(expected)) {
    return typeof actual === "number" && Number.isNaN(actual);
  }
  if (Object.is(actual, expected)) return true;
  if (actual === null || expected === null) return actual === expected;
  if (actual instanceof Uint8Array && expected instanceof Uint8Array) {
    return (
      actual.length === expected.length &&
      actual.every((v, i) => v === expected[i])
    );
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return (
      actual.length === expected.length &&
      actual.every((v, i) => equalish(v, expected[i]))
    );
  }
  if (
    typeof actual === "object" &&
    typeof expected === "object" &&
    actual !== null &&
    expected !== null &&
    !Array.isArray(actual) &&
    !Array.isArray(expected)
  ) {
    // flags comparisons: expected only lists set flags.
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const key of keys) {
      const a = (actual as Record<string, unknown>)[key];
      const e = (expected as Record<string, unknown>)[key];
      if (a === false && e === undefined) continue;
      if (e === false && a === undefined) continue;
      if (!equalish(a, e)) return false;
    }
    return true;
  }
  return false;
}

function show(v: unknown): string {
  if (typeof v === "bigint") return `${v}n`;
  if (v === undefined) return "undefined";
  try {
    return JSON.stringify(v, (_, x) => (typeof x === "bigint" ? `${x}n` : x));
  } catch {
    return String(v);
  }
}

export async function runWastSuite(
  suite: string,
  commands: Command[],
  fetchBytes: (filename: string) => Promise<Uint8Array>,
  simpleModuleBytes?: Uint8Array,
): Promise<WastReport> {
  const report: WastReport = {
    suite,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  };

  const definitions = new Map<string, Uint8Array>();
  const instances = new Map<string, Record<string, unknown>>();
  // Named top-level components register their instance for import by
  // name in later components (wasmtime wast runner semantics).
  const registry = new Map<string, Entity>();
  const hostImports = makeWastHost(simpleModuleBytes);
  let current: Record<string, unknown> | undefined;

  const fail = (line: number, message: string) => {
    report.failed++;
    report.failures.push(`${suite}.wast:${line}: ${message}`);
  };

  for (const command of commands) {
    switch (command.type) {
      case "module": {
        try {
          const bytes = await fetchBytes(command.filename!);
          if (!isComponent(bytes)) {
            report.skipped++;
            current = undefined;
            break;
          }
          const { exports, entity } = await instantiateComponent(
            bytes,
            hostImports,
            registry,
          );
          current = exports;
          if (command.name) {
            instances.set(command.name, exports);
            registry.set(command.name, { kind: "instance", instance: entity });
          }
          report.passed++;
        } catch (e) {
          fail(command.line, `instantiation failed: ${(e as Error).message}`);
          current = undefined;
        }
        break;
      }

      case "module_definition": {
        const bytes = await fetchBytes(command.filename!);
        definitions.set(command.name ?? "", bytes);
        break;
      }

      case "module_instance": {
        try {
          const bytes = definitions.get(command.module ?? "");
          if (bytes === undefined) {
            fail(command.line, `unknown module ${command.module}`);
            break;
          }
          const { exports, entity } = await instantiateComponent(
            bytes,
            hostImports,
            registry,
          );
          current = exports;
          if (command.instance) {
            instances.set(command.instance, exports);
            registry.set(command.instance, {
              kind: "instance",
              instance: entity,
            });
          }
          report.passed++;
        } catch (e) {
          fail(command.line, `instantiation failed: ${(e as Error).message}`);
          current = undefined;
        }
        break;
      }

      case "assert_return":
      case "action": {
        const action = command.action!;
        if (action.type !== "invoke") {
          report.skipped++;
          break;
        }
        const target = action.module ? instances.get(action.module) : current;
        const fn = target?.[action.field] as
          | ((...args: unknown[]) => unknown)
          | undefined;
        if (typeof fn !== "function") {
          fail(command.line, `no export "${action.field}"`);
          break;
        }
        let args: unknown[];
        let expected: unknown[];
        try {
          args = action.args.map(jsonToJs);
          expected = (command.expected ?? []).map(jsonToJs);
        } catch (e) {
          report.skipped++;
          break;
        }
        // Our convention: result-typed exports return the ok payload and
        // throw ComponentError for the err case.
        const expectsResult = (command.expected ?? [])[0]?.type === "result";
        try {
          const actual = fn(...args);
          if (command.type === "action") {
            report.passed++;
            break;
          }
          if (expected.length === 0) {
            if (actual === undefined) {
              report.passed++;
            } else {
              fail(command.line, `expected no result, got ${show(actual)}`);
            }
            break;
          }
          let want = expected[0];
          if (expectsResult) {
            const tagged = want as { tag: string; val: unknown };
            if (tagged.tag === "err") {
              fail(command.line, `expected err, got ${show(actual)}`);
              break;
            }
            want = tagged.val;
          }
          if (equalish(actual, want)) {
            report.passed++;
          } else {
            fail(command.line, `expected ${show(want)}, got ${show(actual)}`);
          }
        } catch (e) {
          if (expectsResult) {
            const tagged = expected[0] as { tag: string; val: unknown };
            if (
              tagged.tag === "err" &&
              e instanceof ComponentError &&
              equalish(e.payload, tagged.val)
            ) {
              report.passed++;
              break;
            }
          }
          fail(command.line, `threw ${(e as Error).message}`);
        }
        break;
      }

      case "assert_trap": {
        const action = command.action!;
        if (action.type !== "invoke") {
          report.skipped++;
          break;
        }
        const target = action.module ? instances.get(action.module) : current;
        const fn = target?.[action.field] as
          | ((...args: unknown[]) => unknown)
          | undefined;
        if (typeof fn !== "function") {
          fail(command.line, `no export "${action.field}"`);
          break;
        }
        let args: unknown[];
        try {
          args = action.args.map(jsonToJs);
        } catch {
          report.skipped++;
          break;
        }
        try {
          fn(...args);
          fail(
            command.line,
            `expected trap "${command.text}" but call succeeded`,
          );
        } catch {
          // Any error counts: trap messages are host-specific.
          report.passed++;
        }
        break;
      }

      case "assert_invalid":
      case "assert_malformed":
      case "assert_unlinkable":
        // Not a validator — record as skipped.
        report.skipped++;
        break;

      default:
        report.skipped++;
        break;
    }
  }

  return report;
}
