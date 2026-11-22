// The picture that tastes of one ingredient — program/v1 entry.
// Copies the bundled mango.png (1024x1024, <= 1 MiB) to
// $MAKEFUN_OUTPUT_DIR/entry.png (fallback /output) byte-for-byte,
// after validating it is a whole PNG of the required size.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), "mango.png");
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const OUT = join(OUT_DIR, "entry.png");

const buf = readFileSync(SOURCE);
if (buf.length > 1048576) {
  throw new Error(`mango.png is ${buf.length} bytes, over the 1048576-byte cap`);
}
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!buf.subarray(0, 8).equals(PNG_SIG)) {
  throw new Error("mango.png does not start with the PNG signature");
}
if (buf.subarray(12, 16).toString("ascii") !== "IHDR") {
  throw new Error("mango.png has no IHDR chunk");
}
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
if (width !== 1024 || height !== 1024) {
  throw new Error(`mango.png is ${width}x${height}, expected 1024x1024`);
}
// Proper terminator: the file must end with a 12-byte IEND chunk.
const tail = buf.subarray(buf.length - 12);
if (tail.readUInt32BE(0) !== 0 || tail.subarray(4, 8).toString("ascii") !== "IEND") {
  throw new Error("mango.png does not end with a valid IEND chunk");
}
if (tail.readUInt32BE(8) !== 0xae426082) {
  throw new Error("mango.png IEND chunk has a bad CRC");
}

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(SOURCE, OUT);
const written = readFileSync(OUT);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
if (sha(written) !== sha(buf)) {
  throw new Error("entry.png bytes differ from mango.png after copy");
}
console.log(`entry.png: ${width}x${height} PNG ${buf.length} bytes sha256=${sha(buf)}`);
