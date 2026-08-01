/**
 * A trap raised by the canonical ABI or the runtime — the component is in
 * an unrecoverable state, mirroring a core wasm trap.
 */
export class ComponentTrap extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComponentTrap";
  }
}

export function trap(message: string): never {
  throw new ComponentTrap(message);
}

export function trapIf(condition: boolean, message: string): void {
  if (condition) {
    throw new ComponentTrap(message);
  }
}

/**
 * Thrown from an exported function whose type is `result<_, E>` when the
 * component returns the error case. The error payload is on `payload`.
 * Mirrors jco's ComponentError so bindings behave the same way.
 */
export class ComponentError extends Error {
  payload: unknown;

  constructor(payload: unknown) {
    super(
      typeof payload === "string" ? payload : "component returned an error",
    );
    this.name = "ComponentError";
    this.payload = payload;
  }
}

/** Feature exists in the spec but this runtime does not support it yet. */
export class UnsupportedFeatureError extends Error {
  constructor(feature: string) {
    super(
      `${feature} is not supported by @runno/component yet. ` +
        `If you hit this with a real-world component please open an issue.`,
    );
    this.name = "UnsupportedFeatureError";
  }
}
