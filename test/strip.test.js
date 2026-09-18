const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { crc32, deflateSync } = require("node:zlib");
const { stripJpegMetadata, stripPngMetadata, stripMetadata, summarizeStrip } = require("../exif-logic.js");
const jpeg = fs.readFileSync(path.join(__dirname, "test_sensitive.jpg"));

// Independent marker reader: collect the bytes that the specification says must survive.
function jpegSegments(bytes) {
  const segments = [{ name: "SOI", start: 0, end: 2 }];
  let offset = 2;
  const names = { 0xdb: "DQT", 0xc0: "SOF0", 0xc4: "DHT", 0xda: "SOS" };
  while (offset < bytes.length) {
    assert.equal(bytes[offset], 255);
    const code = bytes[offset + 1];
    const end = offset + 2 + bytes.readUInt16BE(offset + 2);
    segments.push({ name: names[code] || "APP" + (code - 0xe0), start: offset, end });
    offset = end;
    if (code === 0xda) break;
  }
  return segments;
}
test("fixture SHA-256 and 2,818 bytes are unchanged", () => {
  assert.equal(jpeg.length, 2818);
  assert.equal(createHash("sha256").update(jpeg).digest("hex"),
    "d4586ce8d5d95f5514f7c6c0fda5710f504a8bdc4b46b08a7505df9147d33934");
});
test("JPEG: exactly APP1's 309 bytes disappear, output is 2,509 bytes", () => {
  const output = Buffer.from(stripJpegMetadata(jpeg));
  const parts = jpegSegments(jpeg);
  const app1 = parts.find(part => part.name === "APP1");
  assert.equal(app1.end - app1.start, 309);
  assert.equal(output.length, 2509);
  assert.deepEqual(output, Buffer.concat([jpeg.subarray(0, app1.start), jpeg.subarray(app1.end)]));
  assert.deepEqual(jpegSegments(output).map(part => part.name),
    ["SOI", "DQT", "DQT", "SOF0", "DHT", "DHT", "DHT", "DHT", "SOS"]);
});
test("JPEG: all 1,904 bytes after SOS match byte-for-byte", () => {
  const output = Buffer.from(stripJpegMetadata(jpeg));
  const beforeScan = jpeg.subarray(jpegSegments(jpeg).at(-1).end);
  const afterScan = output.subarray(jpegSegments(output).at(-1).end);
  assert.equal(beforeScan.length, 1904);
  assert.deepEqual(afterScan, beforeScan);
  assert.deepEqual(stripJpegMetadata(output), new Uint8Array(output));
});
for (const marker of [...Array.from({ length: 16 }, (_, index) => 0xe0 + index), 0xfe]) {
  test("JPEG: remove marker " + marker.toString(16) + " with fill bytes", () => {
    const extra = Buffer.from([255, 255, marker, 0, 4, 65, 66]);
    const modified = Buffer.concat([jpeg.subarray(0, 2), extra, jpeg.subarray(2)]);
    assert.deepEqual(stripJpegMetadata(modified), stripJpegMetadata(jpeg));
  });
}
test("JPEG: keep fill before non-metadata and preserve entire SOS remainder", () => {
  const clean = Buffer.from(stripJpegMetadata(jpeg));
  const filled = Buffer.concat([clean.subarray(0, 2), Buffer.from([255]), clean.subarray(2)]);
  assert.deepEqual(stripJpegMetadata(filled), new Uint8Array(filled));
  const trailing = Buffer.concat([jpeg, Buffer.from([255, 254, 0, 4, 65, 66])]);
  assert.deepEqual(Buffer.from(stripJpegMetadata(trailing)).subarray(-6), trailing.subarray(-6));
});
test("JPEG: summarize actual removed type and bytes", () => {
  assert.deepEqual(summarizeStrip(jpeg, stripJpegMetadata(jpeg), "jpeg"), {
    format: "jpeg", beforeBytes: 2818, afterBytes: 2509,
    removed: [{ type: "APP1", bytes: 309, count: 1 }]
  });
  assert.throws(() => summarizeStrip(jpeg, jpeg, "jpeg"));
});

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type, data = Buffer.alloc(0)) {
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length);
  result.write(type, 4, 4, "ascii");
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
  return result;
}
const ihdrData = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
const ihdr = chunk("IHDR", ihdrData);
const idat = chunk("IDAT", deflateSync(Buffer.from([0, 255, 0, 0])));
const iend = chunk("IEND");
const basePng = Buffer.concat([signature, ihdr, idat, iend]);
function chunks(bytes) {
  const result = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    result.push({ type: bytes.toString("ascii", offset + 4, offset + 8), bytes: bytes.subarray(offset, offset + 12 + length) });
    offset += 12 + length;
  }
  return result;
}
test("PNG: tEXt/iTXt removed; IHDR/IDAT/IEND and CRC bytes survive exactly", () => {
  const png = Buffer.concat([signature, ihdr, chunk("tEXt", Buffer.from("Author\0John Doe")), chunk("iTXt"), idat, iend]);
  const output = Buffer.from(stripPngMetadata(png));
  assert.deepEqual(chunks(output).map(item => item.type), ["IHDR", "IDAT", "IEND"]);
  assert.deepEqual(chunks(output).find(item => item.type === "IDAT").bytes, idat);
  assert.deepEqual(output, basePng);
  assert.deepEqual(stripPngMetadata(output), new Uint8Array(output));
});
for (const type of ["iCCP", "eXIf", "tEXt", "zTXt", "iTXt", "tIME", "dSIG", "zzZZ", "mDCv", "cLLi"]) {
  test("PNG: discard " + type, () => {
    const png = Buffer.concat([signature, ihdr, chunk(type, Buffer.from("secret")), idat, iend]);
    assert.deepEqual(Buffer.from(stripPngMetadata(png)), basePng);
    assert.deepEqual(summarizeStrip(png, stripPngMetadata(png), "png").removed, [{ type, bytes: 18, count: 1 }]);
  });
}
for (const type of ["PLTE", "tRNS", "gAMA", "cHRM", "sRGB", "sBIT", "bKGD", "hIST", "pHYs", "sPLT",
  "acTL", "fcTL", "fdAT", "cICP", "mDCV", "cLLI"]) {
  test("PNG: preserve allowed " + type + " byte-for-byte", () => {
    // Tests copy policy, not this synthetic chunk's semantic payload validity.
    const png = Buffer.concat([signature, ihdr, chunk(type, Buffer.from([1, 2, 3])), idat, iend]);
    assert.deepEqual(Buffer.from(stripPngMetadata(png)), png);
  });
}
test("PNG: stop at IEND and summarize repeated chunk types", () => {
  const png = Buffer.concat([signature, ihdr, chunk("tEXt"), chunk("tEXt"), idat, iend, Buffer.from("tail")]);
  const clean = stripPngMetadata(png);
  assert.deepEqual(Buffer.from(clean), basePng);
  assert.deepEqual(summarizeStrip(png, clean, "png").removed,
    [{ type: "tEXt", bytes: 24, count: 2 }, { type: "TRAILING", bytes: 4, count: 1 }]);
});
for (const [name, bytes] of [
  ["empty", Buffer.alloc(0)], ["short JPEG", Buffer.from([255, 216, 255])],
  ["JPEG wrong marker", Buffer.from([255, 216, 0])], ["JPEG short length", Buffer.from([255, 216, 255, 224, 0, 1])],
  ["JPEG truncated APP", jpeg.subarray(0, 100)], ["PNG signature only", signature],
  ["PNG truncated CRC", basePng.subarray(0, -1)], ["PNG no IDAT", Buffer.concat([signature, ihdr, iend])],
  ["PNG no IHDR", Buffer.concat([signature, idat, iend])]
]) {
  test("reject malformed input: " + name, () => assert.throws(() => stripMetadata(bytes)));
}
test("format-specific parsers reject incorrect signatures", () => {
  assert.throws(() => stripJpegMetadata(basePng));
  assert.throws(() => stripPngMetadata(jpeg));
});
