/**
 * Handle tables and resource state, following CanonicalABI.md.
 */

import { trapIf } from "./errors.ts";
import type { RTResource } from "./types.ts";

const MAX_TABLE_LENGTH = 2 ** 28 - 1;

/**
 * Dense table with a free list. Index 0 is reserved so it can act as a
 * null/sentinel value, matching the spec's Table class.
 */
export class Table<T> {
  private array: (T | undefined)[] = [undefined];
  private free: number[] = [];

  get(i: number): T {
    trapIf(i >= this.array.length, `table index ${i} out of bounds`);
    const e = this.array[i];
    trapIf(e === undefined, `table index ${i} is empty`);
    return e as T;
  }

  add(e: T): number {
    const i = this.free.pop();
    if (i !== undefined) {
      this.array[i] = e;
      return i;
    }
    const index = this.array.length;
    trapIf(index > MAX_TABLE_LENGTH, "table full");
    this.array.push(e);
    return index;
  }

  remove(i: number): T {
    const e = this.get(i);
    this.array[i] = undefined;
    this.free.push(i);
    return e;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (const e of this.array) {
      if (e !== undefined) {
        yield e;
      }
    }
  }
}

/**
 * An element of a component instance's `handles` table representing an
 * own or borrow handle to a resource.
 */
export class ResourceHandle {
  rt: RTResource;
  rep: number;
  own: boolean;
  /** The call that lowered this borrow (sync model: a counter token). */
  borrowScope: CallScope | undefined;
  numLends = 0;

  constructor(
    rt: RTResource,
    rep: number,
    own: boolean,
    borrowScope?: CallScope,
  ) {
    this.rt = rt;
    this.rep = rep;
    this.own = own;
    this.borrowScope = borrowScope;
  }
}

/**
 * Sync-only approximation of the spec's Task: tracks borrows created for
 * the duration of a call so they can be checked at call exit, and lenders
 * whose handles must stay alive for the duration of the call.
 */
export class CallScope {
  numBorrows = 0;
  private lenders: ResourceHandle[] = [];

  addLender(handle: ResourceHandle): void {
    handle.numLends++;
    this.lenders.push(handle);
  }

  exit(): void {
    trapIf(
      this.numBorrows > 0,
      "borrowed handles were not dropped before the end of the call",
    );
    for (const lender of this.lenders) {
      lender.numLends--;
    }
    this.lenders.length = 0;
  }
}
