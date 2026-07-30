/**
 * Shared echo-fixture test cases: values for every generated echo
 * component and a runner that round-trips them. Used by both the Node
 * unit tests and the Playwright browser suite.
 */

import { instantiateComponent, ComponentError } from "../../lib/main.ts";

type EchoValues = {
  /** Values passed through run() that must come back structurally equal. */
  values: unknown[];
};

const nine = (s: string) => Array.from({ length: 9 }, (_, i) => `${s}${i}`);

export const ECHO_CASES: Record<string, EchoValues> = {
  bool: { values: [true, false] },
  u8: { values: [0, 1, 255] },
  s8: { values: [-128, 0, 127] },
  u16: { values: [0, 65535] },
  s16: { values: [-32768, 32767] },
  u32: { values: [0, 4294967295] },
  s32: { values: [-2147483648, 2147483647] },
  u64: { values: [0n, 18446744073709551615n] },
  s64: { values: [-9223372036854775808n, 9223372036854775807n] },
  f32: { values: [0, 1.5, -2.25, 2 ** 100] },
  f64: { values: [0, 3.141592653589793, -1e300] },
  char: { values: ["a", "ø", "🌍", "\u{10FFFF}"] },
  string: { values: ["", "hello", "héllø 🌍", "line\nbreak\0nul"] },
  "list-u8": {
    values: [new Uint8Array([1, 2, 3, 255]), new Uint8Array(0)],
  },
  "list-u32": { values: [[1, 2, 3, 4294967295], []] },
  "list-string": { values: [["alpha", "béta", ""], []] },
  record: {
    values: [
      { count: 7, labelText: "seven", ratio: 0.5 },
      { count: 0, labelText: "", ratio: -1 },
    ],
  },
  tuple: { values: [[1, 2n, "three"]] },
  flags3: {
    values: [
      { f0: true, f1: false, f2: true },
      { f0: false, f1: false, f2: false },
    ],
  },
  flags17: {
    values: [
      Object.fromEntries(
        Array.from({ length: 17 }, (_, i) => [`f${i}`, i % 3 === 0]),
      ),
    ],
  },
  enum: { values: ["red", "green", "blue"] },
  "option-u32": { values: [5, 0, undefined] },
  "option-string": { values: ["some", "", undefined] },
  "option-option-u8": {
    values: [
      { tag: "some", val: 5 },
      { tag: "some", val: undefined },
      { tag: "none" },
    ],
  },
  "variant-join-i64": {
    values: [
      { tag: "empty" },
      { tag: "num", val: 42 },
      { tag: "text", val: "hi" },
      { tag: "big", val: 2.5 },
    ],
  },
  "variant-join-f32": {
    values: [
      { tag: "ratio", val: 1.5 },
      { tag: "count", val: 4294967295 },
    ],
  },
  "big-tuple": { values: [nine("value-")] },
  nested: {
    values: [
      [
        { id: 1n, tags: ["x", "y"], kind: { tag: "a" } },
        { id: 18446744073709551615n, tags: [], kind: { tag: "b", val: -5 } },
      ],
      [],
    ],
  },
};

/** Structural equality across the JS value conventions. */
export function structurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (a instanceof Uint8Array || b instanceof Uint8Array) {
    const ua = a as Uint8Array;
    const ub = b as Uint8Array;
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
    if (ua.length !== ub.length) return false;
    return ua.every((v, i) => v === ub[i]);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => structurallyEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const keys = new Set([
      ...Object.keys(a as object),
      ...Object.keys(b as object),
    ]);
    for (const key of keys) {
      if (
        !structurallyEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        )
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function show(v: unknown): string {
  if (typeof v === "bigint") return `${v}n`;
  if (v instanceof Uint8Array) return `Uint8Array([${v.join(",")}])`;
  if (v === undefined) return "undefined";
  return JSON.stringify(v, (_, x) =>
    typeof x === "bigint" ? `${x}n` : x === undefined ? "«undefined»" : x,
  );
}

/**
 * Runs one echo case and returns failure messages (empty = pass).
 */
export async function runEchoCase(
  name: string,
  bytes: Uint8Array,
): Promise<string[]> {
  const failures: string[] = [];
  const testCase = ECHO_CASES[name];
  if (!testCase) {
    return [`${name}: no test values defined`];
  }

  const received: unknown[] = [];
  const echo = (v: unknown) => {
    received.push(v);
    return v;
  };

  let run: (v: unknown) => unknown;
  try {
    const { exports } = await instantiateComponent(bytes, { echo });
    run = exports.run as typeof run;
  } catch (e) {
    return [`${name}: instantiation failed: ${(e as Error).message}`];
  }

  for (const value of testCase.values) {
    received.length = 0;
    try {
      const result = run(value);
      if (!structurallyEqual(result, value)) {
        failures.push(`${name}: run(${show(value)}) returned ${show(result)}`);
      }
      if (received.length !== 1 || !structurallyEqual(received[0], value)) {
        failures.push(
          `${name}: host echo received ${show(received[0])} for ${show(value)}`,
        );
      }
    } catch (e) {
      failures.push(
        `${name}: run(${show(value)}) threw ${(e as Error).message}`,
      );
    }
  }
  return failures;
}

/**
 * The result-typed echo component follows jco call conventions: the host
 * function returns the ok payload or throws ComponentError; the exported
 * run() does the same. Tested separately from the plain value cases.
 */
export async function runResultEchoCase(bytes: Uint8Array): Promise<string[]> {
  const failures: string[] = [];
  const echo = (v: unknown) => {
    const tagged = v as { tag: string; val: unknown };
    if (tagged.tag === "err") {
      throw new ComponentError(tagged.val);
    }
    return tagged.val;
  };
  const { exports } = await instantiateComponent(bytes, { echo });
  const run = exports.run as (v: unknown) => unknown;

  const ok = run({ tag: "ok", val: 7 });
  if (ok !== 7) {
    failures.push(`result: run(ok 7) returned ${show(ok)}`);
  }
  try {
    run({ tag: "err", val: "boom" });
    failures.push("result: run(err) did not throw");
  } catch (e) {
    if (!(e instanceof ComponentError) || e.payload !== "boom") {
      failures.push(
        `result: run(err) threw ${show((e as ComponentError).payload)}`,
      );
    }
  }
  return failures;
}

/**
 * Runs every echo case given a fetcher for fixture bytes. Returns all
 * failure messages; an empty array means the whole suite passed.
 */
export async function runAllEchoCases(
  manifest: string[],
  fetchBytes: (name: string) => Promise<Uint8Array>,
): Promise<string[]> {
  const failures: string[] = [];
  for (const name of manifest) {
    const bytes = await fetchBytes(name);
    if (name === "result-u32-string") {
      failures.push(...(await runResultEchoCase(bytes)));
    } else {
      failures.push(...(await runEchoCase(name, bytes)));
    }
  }
  return failures;
}
