const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const logic = require("../exif-logic.js");

for (const [name, bytes, expected] of [
  ["JPEG", [255, 216, 255], "jpeg"],
  ["PNG", [137, 80, 78, 71, 13, 10, 26, 10], "png"],
  ["empty", [], null],
  ["short JPEG", [255, 216], null],
  ["short PNG", [137, 80, 78, 71], null],
  ["WebP RIFF", [...Buffer.from("RIFFxxxxWEBP")], null]
]) {
  test("detectImageFormat: " + name, () => {
    assert.equal(logic.detectImageFormat(Uint8Array.from(bytes)), expected);
  });
}

for (const [input, expected] of [
  ["GPS Info IFD Pointer", "GPSINFOIFDPOINTER"],
  ["DateTimeOriginal", "DATETIMEORIGINAL"],
  ["gps-latitude_ref", "GPSLATITUDEREF"],
  [null, ""]
]) {
  test("normalizeTagKey: " + input, () => assert.equal(logic.normalizeTagKey(input), expected));
}

const sensitiveGroups = [
  "GPSLATITUDE GPSLATITUDEREF GPSLONGITUDE GPSLONGITUDEREF GPSALTITUDE GPSALTITUDEREF GPSTIMESTAMP GPSDATESTAMP",
  "GPSIMGDIRECTION GPSIMGDIRECTIONREF GPSDESTLATITUDE GPSDESTLONGITUDE GPSPROCESSINGMETHOD GPSAREAINFORMATION",
  "GPSSPEED GPSTRACK GPSMAPDATUM DATETIMEORIGINAL DATETIME DATETIMEDIGITIZED SUBSECTIME SUBSECTIMEORIGINAL",
  "SUBSECTIMEDIGITIZED OFFSETTIME OFFSETTIMEORIGINAL OFFSETTIMEDIGITIZED MAKE MODEL SOFTWARE LENSMAKE LENSMODEL",
  "HOSTCOMPUTER CAMERAOWNERNAME BODYSERIALNUMBER LENSSERIALNUMBER SERIALNUMBER INTERNALSERIALNUMBER",
  "ARTIST COPYRIGHT OWNERNAME RIGHTS CREATOR USERCOMMENT IMAGEDESCRIPTION IMAGEUNIQUEID DOCUMENTNAME",
  "XPAUTHOR XPCOMMENT XPKEYWORDS XPSUBJECT XPTITLE AUTHOR COMMENT DESCRIPTION TITLE DISCLAIMER WARNING SOURCE CREATIONTIME THUMBNAIL"
];
test("SENSITIVE_TAGS: required list matches exactly", () => {
  assert.deepEqual([...logic.SENSITIVE_TAGS].sort(), sensitiveGroups.join(" ").split(" ").sort());
});
for (const key of ["GPSLatitudeRef", "GPSLongitudeRef", "Thumbnail", "ImageDescription", "GPS-Latitude", "Author"]) {
  test("sensitive: " + key, () => assert.equal(logic.isSensitiveTag(key), true));
}
for (const key of ["Image Width", "Bits Per Sample", "Exif IFD Pointer", "GPS Info IFD Pointer", "CreateDate", "ModifyDate"]) {
  test("not sensitive: " + key, () => assert.equal(logic.isSensitiveTag(key), false));
}

// 表示できない値と省略は、文言ではなく文言キーで返す。訳は表示の直前に行う。
const unavailable = { key: "value.unavailable" };
for (const [name, value, expected] of [
  ["description takes precedence", { description: "Tokyo", value: 1 }, { text: "Tokyo" }],
  ["Thumbnail has no value", { description: undefined }, unavailable],
  ["undefined tag", undefined, unavailable],
  ["array value", { value: [1, 2] }, { text: "[1,2]" }],
  ["object value", { value: { x: 1 } }, { text: '{"x":1}' }],
  ["number description falls back", { description: 5, value: 0 }, { text: "0" }],
  ["blank description falls back", { description: " ", value: false }, { text: "false" }],
  ["control characters", { description: "A\u0000\t\n\r\u001fB" }, { text: "AB" }],
  ["200 characters", { value: "x".repeat(200) }, { text: "x".repeat(200) }],
  ["201 characters", { value: "x".repeat(201) },
    { text: "x".repeat(200), key: "value.truncated", values: { count: 201 } }],
  ["code points", { value: "😀".repeat(201) },
    { text: "😀".repeat(200), key: "value.truncated", values: { count: 201 } }]
]) {
  test("formatTagValue: " + name, () => assert.deepEqual(logic.formatTagValue(value), expected));
}
test("formatTagValue: circular object cannot crash rendering", () => {
  const value = {};
  value.self = value;
  assert.deepEqual(logic.formatTagValue({ value }), unavailable);
});
test("failures carry a code, not a display message", () => {
  assert.deepEqual(logic.ERROR_CODES,
    { unsupportedFormat: "unsupported-format", invalidStructure: "invalid-structure", stripMismatch: "strip-mismatch" });
  assert.throws(() => logic.extensionForFormat("webp"), error => error.code === "unsupported-format");
  assert.throws(() => logic.stripJpegMetadata(Uint8Array.from([1, 2, 3])),
    error => error.code === "invalid-structure");
});
test("countSensitiveTags: count tag names, not values", () => {
  assert.equal(logic.countSensitiveTags({ GPSLatitudeRef: {}, Thumbnail: {}, "Image Width": {} }), 2);
  assert.equal(logic.countSensitiveTags({}), 0);
});

for (const [input, expected] of [
  ['a\\/:*?"<>|\u0000\u001fb', "ab"], ["", "cleaned-image"], [".", "cleaned-image"],
  ["...", "cleaned-image"], [" test. ", "test"], ["x".repeat(101), "x".repeat(100)]
]) {
  test("sanitizeFileName: " + JSON.stringify(input), () => assert.equal(logic.sanitizeFileName(input), expected));
}
for (const [name, format, expected] of [
  ["photo", "jpeg", "photo.jpg"], ["photo.jpg", "jpeg", "photo.jpg"],
  ["photo.JPG", "jpeg", "photo.JPG"], ["photo.jpeg", "jpeg", "photo.jpeg"],
  ["photo.PNG", "png", "photo.PNG"], ["", "png", "cleaned-image.png"]
]) {
  test("buildDownloadName: " + name + "/" + format, () => assert.equal(logic.buildDownloadName(name, format), expected));
}
test("format extension and MIME", () => {
  assert.equal(logic.extensionForFormat("jpeg"), ".jpg");
  assert.equal(logic.extensionForFormat("png"), ".png");
  assert.equal(logic.mimeForFormat("jpeg"), "image/jpeg");
  assert.equal(logic.mimeForFormat("png"), "image/png");
  assert.throws(() => logic.extensionForFormat("webp"));
});
test("classic script exposes all functions without DOM or ExifReader", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../exif-logic.js"), "utf8"), context);
  assert.deepEqual(Object.keys(context.ExifLogic).sort(), Object.keys(logic).sort());
  assert.equal(Object.keys(logic).length, 15);
});
