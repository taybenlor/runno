/**
 * A little-endian byte reader over a Uint8Array with the LEB128 and
 * name/vector primitives shared by the core wasm and component binary
 * formats.
 */
export class ByteReader {
  readonly bytes: Uint8Array;
  readonly view: DataView;
  pos: number;

  constructor(bytes: Uint8Array, pos = 0) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = pos;
  }

  get done(): boolean {
    return this.pos >= this.bytes.length;
  }

  byte(): number {
    if (this.pos >= this.bytes.length) {
      throw new ParseError(`Unexpected end of binary at offset ${this.pos}`);
    }
    return this.bytes[this.pos++];
  }

  peek(): number {
    if (this.pos >= this.bytes.length) {
      throw new ParseError(`Unexpected end of binary at offset ${this.pos}`);
    }
    return this.bytes[this.pos];
  }

  expect(value: number, what: string): void {
    const b = this.byte();
    if (b !== value) {
      throw new ParseError(
        `Expected ${what} (0x${value.toString(16)}) but found 0x${b.toString(
          16,
        )} at offset ${this.pos - 1}`,
      );
    }
  }

  /** Unsigned LEB128, at most 32 bits. */
  u32(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const b = this.byte();
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        if (shift === 28 && b > 0x0f) {
          throw new ParseError(`u32 LEB128 overflow at offset ${this.pos}`);
        }
        // The |= above works in signed 32-bit space; force unsigned.
        return result >>> 0;
      }
      shift += 7;
      if (shift >= 35) {
        throw new ParseError(`u32 LEB128 too long at offset ${this.pos}`);
      }
    }
  }

  /** Signed LEB128, at most 64 bits, as bigint. */
  s64(): bigint {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      const b = this.byte();
      result |= BigInt(b & 0x7f) << shift;
      shift += 7n;
      if ((b & 0x80) === 0) {
        if (shift < 64n && b & 0x40) {
          result |= -1n << shift;
        }
        return BigInt.asIntN(64, result);
      }
      if (shift >= 70n) {
        throw new ParseError(`s64 LEB128 too long at offset ${this.pos}`);
      }
    }
  }

  /** Unsigned LEB128, at most 64 bits, as bigint. */
  u64(): bigint {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      const b = this.byte();
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        return BigInt.asUintN(64, result);
      }
      shift += 7n;
      if (shift >= 70n) {
        throw new ParseError(`u64 LEB128 too long at offset ${this.pos}`);
      }
    }
  }

  /** Signed LEB128, at most 33 bits — used for type opcodes vs indices. */
  s33(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const b = this.byte();
      result |= (b & 0x7f) << shift;
      shift += 7;
      if ((b & 0x80) === 0) {
        if (shift < 32 && b & 0x40) {
          result |= -1 << shift;
        }
        return result;
      }
      if (shift >= 35) {
        throw new ParseError(`s33 LEB128 too long at offset ${this.pos}`);
      }
    }
  }

  f32(): number {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  f64(): number {
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  raw(length: number): Uint8Array {
    if (this.pos + length > this.bytes.length) {
      throw new ParseError(
        `Unexpected end of binary reading ${length} bytes at offset ${this.pos}`,
      );
    }
    const slice = this.bytes.subarray(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }

  /** A name is a u32 length followed by that many bytes of UTF-8. */
  name(): string {
    const length = this.u32();
    const bytes = this.raw(length);
    return UTF8_DECODER.decode(bytes);
  }

  /** Reads vec(T) given a function that reads one T. */
  vec<T>(read: (reader: this) => T): T[] {
    const length = this.u32();
    const items: T[] = [];
    for (let i = 0; i < length; i++) {
      items.push(read(this));
    }
    return items;
  }

  /** Reads the optional pattern: 0x00 => none, 0x01 t => some t. */
  optional<T>(read: (reader: this) => T): T | undefined {
    const flag = this.byte();
    if (flag === 0x00) {
      return undefined;
    }
    if (flag === 0x01) {
      return read(this);
    }
    throw new ParseError(
      `Expected optional flag 0x00/0x01 but found 0x${flag.toString(
        16,
      )} at offset ${this.pos - 1}`,
    );
  }

  /** A sub-reader over the next `length` bytes, advancing this reader. */
  subReader(length: number): ByteReader {
    return new ByteReader(this.raw(length));
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
