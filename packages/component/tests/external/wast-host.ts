/**
 * The host imports wasmtime's component wast runner provides
 * (crates/wast/src/spectest.rs, link_component_spectest), translated to
 * this runtime's jco-style conventions.
 */

interface ResourceState {
  drops: number;
  lastDrop: number;
}

export function makeWastHost(simpleModuleBytes?: Uint8Array) {
  const state: ResourceState = { drops: 0, lastDrop: 0 };

  class Resource1 {
    rep: number;
    constructor(rep: number) {
      this.rep = rep;
    }
    static assert(resource: Resource1, rep: number): void {
      if (resource.rep !== rep) {
        throw new Error(`resource1 rep ${resource.rep} != ${rep}`);
      }
    }
    static lastDrop(): number {
      return state.lastDrop;
    }
    static drops(): number {
      return state.drops;
    }
    simple(rep: number): void {
      if (this.rep !== rep) {
        throw new Error(`resource1 rep ${this.rep} != ${rep}`);
      }
    }
    takeBorrow(_b: Resource1): void {}
    takeOwn(_b: Resource1): void {}
    [Symbol.dispose](): void {
      state.drops++;
      state.lastDrop = this.rep;
    }
  }

  class Resource2 {
    rep: number;
    constructor(rep: number) {
      this.rep = rep;
    }
    [Symbol.dispose](): void {}
  }

  class Resource1Again extends Resource1 {
    [Symbol.dispose](): void {
      throw new Error("resource1-again shouldn't be destroyed");
    }
  }

  const host: Record<string, unknown> = {
    returnThree: () => 3,
    nested: { returnFour: () => 4 },
    Resource1,
    Resource2,
    Resource1Again,
  };
  if (simpleModuleBytes) {
    host["simple-module"] = simpleModuleBytes;
  }

  return {
    "host-return-two": () => 2,
    "host-echo-u32": (v: number) => v,
    host,
  };
}
