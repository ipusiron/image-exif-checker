/* DOMやExifReaderに依存しない、表示とバイナリ処理。 */
const ExifLogic = (() => {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const SENSITIVE_TAGS = new Set([
    // 位置
    "GPSLATITUDE", "GPSLATITUDEREF", "GPSLONGITUDE", "GPSLONGITUDEREF",
    "GPSALTITUDE", "GPSALTITUDEREF", "GPSTIMESTAMP", "GPSDATESTAMP",
    "GPSIMGDIRECTION", "GPSIMGDIRECTIONREF", "GPSDESTLATITUDE", "GPSDESTLONGITUDE",
    "GPSPROCESSINGMETHOD", "GPSAREAINFORMATION", "GPSSPEED", "GPSTRACK", "GPSMAPDATUM",
    // 日時
    "DATETIMEORIGINAL", "DATETIME", "DATETIMEDIGITIZED", "SUBSECTIME",
    "SUBSECTIMEORIGINAL", "SUBSECTIMEDIGITIZED", "OFFSETTIME", "OFFSETTIMEORIGINAL", "OFFSETTIMEDIGITIZED",
    // 機材
    "MAKE", "MODEL", "SOFTWARE", "LENSMAKE", "LENSMODEL", "HOSTCOMPUTER", "CAMERAOWNERNAME",
    "BODYSERIALNUMBER", "LENSSERIALNUMBER", "SERIALNUMBER", "INTERNALSERIALNUMBER",
    // 個人・著作
    "ARTIST", "COPYRIGHT", "OWNERNAME", "RIGHTS", "CREATOR", "USERCOMMENT", "IMAGEDESCRIPTION",
    "IMAGEUNIQUEID", "DOCUMENTNAME", "XPAUTHOR", "XPCOMMENT", "XPKEYWORDS", "XPSUBJECT", "XPTITLE",
    // PNGのテキストと埋め込みサムネイル
    "AUTHOR", "COMMENT", "DESCRIPTION", "TITLE", "DISCLAIMER", "WARNING", "SOURCE", "CREATIONTIME", "THUMBNAIL"
  ]);
  const PNG_KEEP = new Set([
    "IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "sBIT",
    "bKGD", "hIST", "pHYs", "sPLT", "acTL", "fcTL", "fdAT", "cICP", "mDCV", "cLLI"
  ]);

  function detectImageFormat(bytes) {
    if (!(bytes instanceof Uint8Array)) return null;
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
    if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return "png";
    return null;
  }

  function normalizeTagKey(key) {
    return typeof key === "string" ? key.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  }

  function isSensitiveTag(key) {
    return SENSITIVE_TAGS.has(normalizeTagKey(key));
  }

  function formatTagValue(tag) {
    let value;
    if (typeof tag?.description === "string" && tag.description.trim()) {
      value = tag.description;
    } else if (tag?.value !== undefined && tag.value !== null) {
      try {
        value = typeof tag.value === "object" ? JSON.stringify(tag.value) : String(tag.value);
      } catch {
        // 循環参照など、表示できない値も画面全体の解析を止めない。
      }
    }
    if (typeof value !== "string") return "（値を表示できません）";
    const chars = Array.from(value.replace(/[\u0000-\u001f]/g, ""));
    if (!chars.length) return "（値を表示できません）";
    return chars.length > 200 ? chars.slice(0, 200).join("") + "…（全 " + chars.length + " 文字）" : chars.join("");
  }

  function countSensitiveTags(tags) {
    return Object.keys(tags || {}).filter(isSensitiveTag).length;
  }

  function sanitizeFileName(name) {
    const clean = String(name ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().replace(/\.+$/, "");
    return Array.from(clean).slice(0, 100).join("") || "cleaned-image";
  }

  function extensionForFormat(format) {
    if (format === "jpeg") return ".jpg";
    if (format === "png") return ".png";
    throw new Error("未対応の画像形式です。");
  }

  function mimeForFormat(format) {
    extensionForFormat(format);
    return "image/" + format;
  }

  function buildDownloadName(name, format) {
    const clean = sanitizeFileName(name);
    const extension = extensionForFormat(format);
    const existing = format === "jpeg" ? /\.jpe?g$/i : /\.png$/i;
    return existing.test(clean) ? clean : clean + extension;
  }

  function invalidImage() {
    throw new Error("画像の構造が壊れています。");
  }

  /** JPEGのヘッダーだけを読む。SOSの後は解釈せず、残りを1つの範囲として保持する。 */
  function jpegParts(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes[0] !== 0xff || bytes[1] !== 0xd8) invalidImage();
    const parts = [{ type: "SOI", start: 0, end: 2, remove: false }];
    let offset = 2;
    while (offset < bytes.length) {
      const start = offset;
      if (bytes[offset++] !== 0xff) invalidImage();
      while (bytes[offset] === 0xff) offset++;
      if (offset >= bytes.length) invalidImage();
      const marker = bytes[offset++];
      if (marker === 0 || marker === 0xd8 || marker === 0xd9) invalidImage();
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        parts.push({ type: "FF" + marker.toString(16).toUpperCase(), start, end: offset, remove: false });
        continue;
      }
      if (offset + 2 > bytes.length) invalidImage();
      const length = bytes[offset] * 256 + bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) invalidImage();
      const end = offset + length;
      const app = marker >= 0xe0 && marker <= 0xef;
      const type = app ? "APP" + (marker - 0xe0) : marker === 0xfe ? "COM" : "FF" + marker.toString(16).toUpperCase();
      parts.push({ type, start, end, remove: app || marker === 0xfe });
      offset = end;
      if (marker === 0xda) {
        if (offset >= bytes.length) invalidImage();
        parts.push({ type: "SCAN", start: offset, end: bytes.length, remove: false });
        return parts;
      }
    }
    invalidImage();
  }

  /** PNGのチャンク境界と必須チャンクを確認する。CRCを含めた範囲を返す。 */
  function pngParts(bytes) {
    if (detectImageFormat(bytes) !== "png") invalidImage();
    const parts = [{ type: "SIGNATURE", start: 0, end: 8, remove: false }];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    let imageData = false;
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) invalidImage();
      const length = view.getUint32(offset);
      const end = offset + length + 12;
      if (length > 0x7fffffff || end > bytes.length) invalidImage();
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (!/^[A-Za-z]{4}$/.test(type)) invalidImage();
      if (offset === 8 && (type !== "IHDR" || length !== 13)) invalidImage();
      if (type === "IHDR" && (offset !== 8 || length !== 13)) invalidImage();
      if (type === "IDAT") imageData = true;
      parts.push({ type, start: offset, end, remove: !PNG_KEEP.has(type) });
      if (type === "IEND") {
        if (length !== 0 || !imageData) invalidImage();
        if (end < bytes.length) parts.push({ type: "TRAILING", start: end, end: bytes.length, remove: true });
        return parts;
      }
      offset = end;
    }
    invalidImage();
  }

  function copyParts(bytes, parts) {
    const kept = parts.filter(part => !part.remove);
    const result = new Uint8Array(kept.reduce((sum, part) => sum + part.end - part.start, 0));
    let offset = 0;
    for (const part of kept) {
      result.set(bytes.subarray(part.start, part.end), offset);
      offset += part.end - part.start;
    }
    return result;
  }

  function stripJpegMetadata(bytes) {
    return copyParts(bytes, jpegParts(bytes));
  }

  function stripPngMetadata(bytes) {
    return copyParts(bytes, pngParts(bytes));
  }

  function stripMetadata(bytes, format = detectImageFormat(bytes)) {
    if (format === "jpeg") return stripJpegMetadata(bytes);
    if (format === "png") return stripPngMetadata(bytes);
    throw new Error("未対応の画像形式です。");
  }

  function summarizeStrip(before, after, format) {
    const expected = stripMetadata(before, format);
    if (expected.length !== after.length || expected.some((byte, index) => byte !== after[index])) {
      throw new Error("除去結果が一致しません。");
    }
    const parts = format === "jpeg" ? jpegParts(before) : pngParts(before);
    const removed = new Map();
    for (const part of parts.filter(item => item.remove)) {
      const item = removed.get(part.type) || { type: part.type, bytes: 0, count: 0 };
      item.bytes += part.end - part.start;
      item.count++;
      removed.set(part.type, item);
    }
    return { format, beforeBytes: before.length, afterBytes: after.length, removed: [...removed.values()] };
  }

  return {
    detectImageFormat, normalizeTagKey, isSensitiveTag, SENSITIVE_TAGS, formatTagValue,
    countSensitiveTags, sanitizeFileName, buildDownloadName, extensionForFormat, mimeForFormat,
    stripJpegMetadata, stripPngMetadata, stripMetadata, summarizeStrip
  };
})();

globalThis.ExifLogic = ExifLogic;
if (typeof module === "object" && module.exports) module.exports = ExifLogic;
