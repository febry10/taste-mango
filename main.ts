// Entry point for "The picture that tastes of one ingredient".
//
// The scored artefact is a single PNG image, not a running service.
// This program does three things, in order:
//   1. validate the bundled mango.png against every hard limit
//      (real PNG, exactly 1024x1024, at most 1 MiB, properly closed);
//   2. copy those bytes unchanged to $MAKEFUN_OUTPUT_DIR/entry.png
//      (falling back to /output when the variable is unset);
//   3. read the copy back and compare SHA-256 digests, so a partial
//      or altered write can never slip through silently.
// It prints exactly one summary line and exits 0 on success. There
// are no timestamps and no random inputs anywhere below, which is
// what makes repeated runs byte-for-byte deterministic.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mangoPath = join(here, "mango.png");
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const outPath = join(outDir, "entry.png");

const LIMIT = 1048576;
const W = 1024;
const H = 1024;
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function die(msg: string): never {
  throw new Error(msg);
}

function check(data: Buffer): void {
  // An empty file would also fail the signature test, but naming the
  // actual problem makes a broken render much faster to diagnose.
  if (data.length === 0) die("mango.png is empty");
  if (data.length > LIMIT) die(`too large: ${data.length} > ${LIMIT}`);
  if (data.length < 33) die("file too short for a PNG");
  if (!data.subarray(0, 8).equals(SIG)) die("bad PNG signature");
  if (data.readUInt32BE(8) !== 13 || data.toString("latin1", 12, 16) !== "IHDR") {
    die("first chunk is not IHDR");
  }
  const w = data.readUInt32BE(16);
  const h = data.readUInt32BE(20);
  if (w !== W || h !== H) die(`wrong size: ${w}x${h}, want ${W}x${H}`);
  const bitDepth = data[24];
  const colorType = data[25];
  if (bitDepth !== 8) die(`unexpected bit depth: ${bitDepth}`);
  if (colorType !== 2 && colorType !== 3 && colorType !== 6) {
    die(`unexpected color type: ${colorType}`);
  }
  // A well-formed PNG ends with a 12-byte IEND chunk.
  const tail = data.subarray(data.length - 12);
  if (tail.readUInt32BE(0) !== 0 || tail.toString("latin1", 4, 8) !== "IEND") {
    die("missing IEND terminator");
  }
}

const data = readFileSync(mangoPath);
check(data);

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
copyFileSync(mangoPath, outPath);

const back = readFileSync(outPath);
const want = createHash("sha256").update(data).digest("hex");
const got = createHash("sha256").update(back).digest("hex");
if (want !== got) die("copy differs from source (sha256 mismatch)");

console.log(`entry.png written: ${back.length} bytes, 1024x1024 PNG, sha256 ${got.slice(0, 16)}...`);
