import { i2h, i2s, s2i } from "../utils/mod.ts";

/**
 * Creates new SHA-256 state
 */
function init(h?: Uint32Array): Uint32Array {
  if (!h) h = new Uint32Array(8);

  // SHA-256 state contains eight 32-bit integers
  h[0] = 0x6A09E667;
  h[1] = 0xBB67AE85;
  h[2] = 0x3C6EF372;
  h[3] = 0xA54FF53A;
  h[4] = 0x510E527F;
  h[5] = 0x9B05688C;
  h[6] = 0x1F83D9AB;
  h[7] = 0x5BE0CD19;

  return h;
}

/** Array to use to store round words. */
const words = new Uint32Array(64);

// deno-fmt-ignore
/** K table for SHA-256 */
const _k = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * Perform round function
 */
function round(state: Uint32Array, data: Uint32Array) {
  // initialize hash value for this chunk
  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];

  words.set(data);

  for (let i = 16; i < 64; i += 1) {
    // XOR word 2 words ago rot right 17, rot right 19, shft right 10
    let t1 = words[i - 2];
    t1 = ((t1 >>> 17) | (t1 << 15)) ^
      ((t1 >>> 19) | (t1 << 13)) ^
      (t1 >>> 10);

    // XOR word 15 words ago rot right 7, rot right 18, shft right 3
    let t2 = words[i - 15];
    t2 = ((t2 >>> 7) | (t2 << 25)) ^
      ((t2 >>> 18) | (t2 << 14)) ^
      (t2 >>> 3);

    // sum(t1, word 7 ago, t2, word 16 ago) modulo 2^32
    words[i] = t1 + words[i - 7] + t2 + words[i - 16];
  }

  // Round Function
  for (let i = 0; i < 64; i += 1) {
    // Sum1(e)
    const s1 = ((e >>> 6) | (e << 26)) ^
      ((e >>> 11) | (e << 21)) ^
      ((e >>> 25) | (e << 7));

    // Ch(e, f, g) (optimized the same way as SHA-1)
    const ch = g ^ (e & (f ^ g));

    // Sum0(a)
    const s0 = ((a >>> 2) | (a << 30)) ^
      ((a >>> 13) | (a << 19)) ^
      ((a >>> 22) | (a << 10));

    // Maj(a, b, c) (optimized the same way as SHA-1)
    const maj = (a & b) | (c & (a ^ b));

    // main algorithm
    const t1 = h + s1 + ch + _k[i] + words[i];
    const t2 = s0 + maj;

    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }

  // update hash state
  state[0] += a;
  state[1] += b;
  state[2] += c;
  state[3] += d;
  state[4] += e;
  state[5] += f;
  state[6] += g;
  state[7] += h;
}

/**
 * Pre-processing round buffer for string input
 */
function preprocess(
  str: string,
  buf: Uint32Array,
  state: Uint32Array,
  offset = 0,
) {
  while (str.length >= 64) {
    for (let i = offset; i < 16; i++) buf[i] = s2i(str, i * 4);
    str = str.slice(64 - offset * 4);
    offset = 0;

    round(state, buf);
  }

  return str;
}

/**
 * Process input buffer
 */
function process(
  input: Uint32Array,
  buf: Uint32Array,
  state: Uint32Array,
  offset = 0,
) {
  while (input.length >= buf.length - offset) {
    buf.set(input.subarray(0, buf.length - offset), offset);
    input = input.subarray(buf.length - offset);
    offset = 0;

    round(state, buf);
  }

  if (input.length > 0) {
    buf.set(input, offset);
    offset += input.length;
  }

  return offset;
}

/**
 * Repeatable part
 */
function finish(
  len: number,
  buf: Uint32Array,
  state: Uint32Array,
  offset = 0,
) {
  const len64hi = (len / 0x100000000) >>> 0;
  const len64lo = len >>> 0;

  for (let i = offset + 1; i < buf.length; i++) buf[i] = 0;

  if (offset >= 14) {
    round(state, buf);
    for (let i = 0; i < buf.length; i++) buf[i] = 0;
  }

  buf[14] = (len64hi << 3) | (len64hi >>> 28);
  buf[15] = len64lo << 3;

  round(state, buf);
}

/**
 * Adds padding to message
 */
function finalizestr(
  chunk: string,
  len: number,
  buf: Uint32Array,
  state: Uint32Array,
  offset = 0,
) {
  for (; chunk.length >= 4; offset++) {
    buf[offset] = s2i(chunk, 0);
    chunk = chunk.slice(4);
  }

  if (offset >= 16) {
    round(state, buf);
    offset = 0;
  }

  buf[offset] = s2i(`${chunk}\x80\x00\x00\x00`, 0);
  finish(len, buf, state, offset);
}

/**
 * Adds padding to buffer
 */
function finalize(
  len: number,
  buf: Uint32Array,
  state: Uint32Array,
  offset = 0,
) {
  buf[offset] = 0x80000000;
  finish(len, buf, state, offset);
}

/**
 * Output depending on format
 */
function out(state: Uint32Array, format: "array"): Uint32Array;
function out(state: Uint32Array, format: "hex" | "binary"): string;
// deno-lint-ignore no-explicit-any
function out(state: Uint32Array, format: any = "array") {
  switch (format) {
    case "hex":
      return (
        i2h(state[0]) +
        i2h(state[1]) +
        i2h(state[2]) +
        i2h(state[3]) +
        i2h(state[4]) +
        i2h(state[5]) +
        i2h(state[6]) +
        i2h(state[7])
      );

    case "binary":
      return (
        i2s(state[0]) +
        i2s(state[1]) +
        i2s(state[2]) +
        i2s(state[3]) +
        i2s(state[4]) +
        i2s(state[5]) +
        i2s(state[6]) +
        i2s(state[7])
      );

    default:
      return state;
  }
}
/**
 * Stream handler for hashing
 */
class Stream {
  buffer: Uint32Array;
  state: Uint32Array;
  length: number;
  offset: number;
  tail: string;

  constructor(buf?: Uint32Array) {
    this.buffer = new Uint32Array(16);
    this.state = init(buf);
    this.length = 0;
    this.offset = 0;
    this.tail = "";
  }

  update(chunk: string | Uint32Array) {
    if (typeof chunk === "string") {
      this.length += chunk.length;
      this.tail = preprocess(
        this.tail + chunk,
        this.buffer,
        this.state,
        this.offset,
      );
      this.offset = 0;
    } else {
      if (this.tail.length > 0) {
        throw new Error("Unable to update hash-stream with array");
      }

      this.length += chunk.length * 4;
      this.offset = process(chunk, this.buffer, this.state, this.offset);
    }

    return this;
  }

  digest(): Uint32Array;
  digest(format: "hex" | "binary"): string;
  // deno-lint-ignore no-explicit-any
  digest(format: any = "array"): any {
    if (this.tail.length > 0) {
      finalizestr(this.tail, this.length, this.buffer, this.state, this.offset);
    } else {
      finalize(this.length, this.buffer, this.state, this.offset);
    }

    return out(this.state, format);
  }

  clear() {
    this.state = init();
    this.length = 0;
    this.offset = 0;
    this.tail = "";
  }
}

/**
 * Hash as single function
 */
function sha256(message: string | Uint32Array): Uint32Array;
function sha256(
  message: string | Uint32Array,
  format: "hex" | "binary",
): string;
function sha256(
  message: string | Uint32Array,
  // deno-lint-ignore no-explicit-any
  format: any = "array",
): string | Uint32Array {
  const buf = new Uint32Array(16);
  const state = init();

  if (typeof message === "string") {
    finalizestr(preprocess(message, buf, state), message.length, buf, state);
  } else finalize(message.length * 4, buf, state, process(message, buf, state));

  return out(state, format);
}

/**
 * Hash with stream constructor
 */
sha256.stream = (buf?: Uint32Array) => new Stream(buf);
sha256.blockLength = 64;
sha256.digestLength = 32;

export default sha256;
