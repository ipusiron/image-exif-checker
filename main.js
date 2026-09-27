const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const metaInfo = document.getElementById("metaInfo");
const cleanButton = document.getElementById("cleanButton");
const filenameInput = document.getElementById("filenameInput");
const extensionLabel = document.getElementById("fileExtensionLabel");
const cleaningModes = document.getElementById("cleaningModes");
const resultInfo = document.getElementById("resultInfo");
const langToggle = document.getElementById("langToggle");

let originalImageBlob = null;
let originalMimeType = "image/jpeg";
let originalExtension = ".jpg";
let originalBytes = null;
let originalFormat = null;
let busy = false;

// 画面の状態は文言ではなくキーと値で持つ。言語を変えても訳し直せるようにする。
let metaState = { kind: "empty" };
let resultState = { kind: "empty" };

const CANVAS_CONTEXT_ERROR = "canvas-context";
const CANVAS_BLOB_ERROR = "canvas-blob";
const UNREADABLE_IMAGE_ERROR = "unreadable-image";

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

/** 解析の失敗は、表示中の文言ではなくエラーコードで見分ける。 */
function analysisErrorKey(error) {
  return error?.code === ExifLogic.ERROR_CODES.unsupportedFormat ? "error.unsupported" : "error.unreadable";
}

I18n.init();
langToggle.addEventListener("click", () => {
  I18n.setLanguage(I18n.language === "ja" ? "en" : "ja");
});
document.addEventListener("languagechange", () => {
  renderMeta();
  renderResult();
});

// ファイル選択時
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
  fileInput.value = "";
});

// ドラッグ＆ドロップ対応
dropZone.addEventListener("click", () => {
  if (!busy) fileInput.click();
});
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (!busy) fileInput.click();
  }
});
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (!busy) dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFile(file);
  }
});

// Exif情報の解析とUI更新
async function handleFile(file) {
  if (busy) return;
  resetImage();
  setBusy(true);
  metaState = { kind: "status", key: "status.analyzing" };
  resultState = { kind: "empty" };
  renderMeta();
  renderResult();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const format = ExifLogic.detectImageFormat(bytes);
    if (!format) throw codedError(ExifLogic.ERROR_CODES.unsupportedFormat);

    // メタ情報の有無とは別に、コンテナーの境界とブラウザーでの画像復号を確認する。
    ExifLogic.stripMetadata(bytes, format);
    const imageBlob = new Blob([bytes], { type: ExifLogic.mimeForFormat(format) });
    await loadImage(imageBlob);
    let tags;
    try {
      tags = ExifReader.load(arrayBuffer);
    } catch {
      // 構造と画像復号が正常なら、ExifReaderの解析失敗はメタ情報なしとして扱う。
      tags = {};
    }
    metaState = { kind: "tags", tags };
    renderMeta();

    originalImageBlob = imageBlob;
    originalBytes = bytes;
    originalFormat = format;
    originalMimeType = ExifLogic.mimeForFormat(format);
    originalExtension = ExifLogic.extensionForFormat(format);

    // 拡張子なしファイル名をセット
    const originalName = file.name.replace(/\.[^/.]+$/, "");
    filenameInput.value = ExifLogic.sanitizeFileName(originalName);
    extensionLabel.textContent = originalExtension;
  } catch (error) {
    resetImage();
    metaState = { kind: "status", key: analysisErrorKey(error) };
    renderMeta();
  } finally {
    setBusy(false);
  }
}

/** 表示用の値は、記述の text と文言キーを組み合わせて作る。 */
function describeTagValue(value) {
  const suffix = value.key ? I18n.t(value.key, value.values || {}) : "";
  return (value.text || "") + suffix;
}

function renderMeta() {
  if (metaState.kind === "empty") {
    metaInfo.replaceChildren();
    return;
  }
  if (metaState.kind === "status") {
    metaInfo.textContent = I18n.t(metaState.key);
    return;
  }
  renderMetadata(metaState.tags);
}

function renderMetadata(tags) {
  const entries = Object.entries(tags);
  const count = ExifLogic.countSensitiveTags(tags);
  metaInfo.replaceChildren();
  const summary = document.createElement("p");
  summary.className = "risk-summary";
  summary.textContent = count > 0 ? I18n.t("risk.found", { count }) : I18n.t("risk.none");
  metaInfo.appendChild(summary);
  if (entries.length === 0) {
    const message = document.createElement("p");
    message.textContent = I18n.t("meta.none");
    metaInfo.appendChild(message);
    return;
  }

  // XSS対策: DOM APIを使用して安全に要素を構築
  const h3 = document.createElement("h3");
  h3.textContent = I18n.t("meta.heading");
  metaInfo.appendChild(h3);
  const ul = document.createElement("ul");
  entries.forEach(([key, val]) => {
    const isSensitive = ExifLogic.isSensitiveTag(key);
    const li = document.createElement("li");
    li.dataset.tag = key;
    const keyStrong = document.createElement("strong");
    if (isSensitive) keyStrong.classList.add("sensitive");
    // Exifのタグ名は固有名詞なので訳さない。
    keyStrong.textContent = key;
    const displayValue = describeTagValue(ExifLogic.formatTagValue(val));
    li.appendChild(keyStrong);
    const caution = isSensitive ? I18n.t("tag.caution") : "";
    li.appendChild(document.createTextNode(caution + ": " + displayValue));
    ul.appendChild(li);
  });
  metaInfo.appendChild(ul);
}

function renderResult() {
  if (resultState.kind === "empty") {
    resultInfo.textContent = "";
    return;
  }
  if (resultState.kind === "status") {
    resultInfo.textContent = I18n.t(resultState.key);
    return;
  }
  const description = resultState.summary ? describeStrip(resultState.summary) : I18n.t("result.reencoded");
  const verify = I18n.t(resultState.verify.key, resultState.verify.values || {});
  resultInfo.textContent = description + "\n" + verify;
}

// Exifを除去して保存（元形式）
cleanButton.addEventListener("click", async () => {
  if (busy || !originalImageBlob) return;
  setBusy(true);
  resultState = { kind: "status", key: "status.cleaning" };
  renderResult();
  try {
    const method = document.querySelector('input[name="cleanMethod"]:checked').value;
    let blob;
    let summary = null;
    if (method === "lossless") {
      const cleaned = ExifLogic.stripMetadata(originalBytes, originalFormat);
      summary = ExifLogic.summarizeStrip(originalBytes, cleaned, originalFormat);
      blob = new Blob([cleaned], { type: originalMimeType });
    } else {
      blob = await reencodeImage(originalImageBlob, originalMimeType);
    }
    const output = await blob.arrayBuffer();
    let verify;
    try {
      const remaining = ExifLogic.countSensitiveTags(ExifReader.load(output));
      verify = remaining === 0
        ? { key: "verify.clean" }
        : { key: "verify.remaining", values: { count: remaining } };
    } catch {
      verify = { key: "verify.noMetadata" };
    }
    resultState = { kind: "done", summary, verify };
    renderResult();
    await downloadBlob(blob, ExifLogic.buildDownloadName(filenameInput.value, originalFormat));
  } catch {
    resultState = { kind: "status", key: "error.saveFailed" };
    renderResult();
  } finally {
    setBusy(false);
  }
});

function resetImage() {
  originalImageBlob = null;
  originalBytes = null;
  originalFormat = null;
  originalMimeType = "image/jpeg";
  originalExtension = ".jpg";
  filenameInput.value = "";
  extensionLabel.textContent = originalExtension;
}

function setBusy(value) {
  busy = value;
  fileInput.disabled = value;
  filenameInput.disabled = value;
  cleaningModes.disabled = value;
  cleanButton.disabled = value || !originalImageBlob;
  dropZone.setAttribute("aria-disabled", String(value));
  metaInfo.setAttribute("aria-busy", String(value));
}

/** 作成したURLは、読み込み成功・失敗のどちらでも必ず解放する。 */
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(codedError(UNREADABLE_IMAGE_ERROR));
    };
    img.src = url;
  });
}

async function reencodeImage(blob, mime) {
  const img = await loadImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw codedError(CANVAS_CONTEXT_ERROR);
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    const complete = output => output ? resolve(output) : reject(codedError(CANVAS_BLOB_ERROR));
    if (mime === "image/jpeg") canvas.toBlob(complete, mime, 0.95);
    else canvas.toBlob(complete, mime);
  });
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  try {
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // ダウンロード開始を待ってから解放する（読み込み用URLとは別に管理）。
    await new Promise(resolve => setTimeout(resolve, 1000));
  } finally {
    a.remove();
    URL.revokeObjectURL(url);
  }
}

function describeStrip(summary) {
  const removed = summary.removed.map(item => I18n.t("result.stripItem", {
    // セグメント／チャンクの名前は規格上の識別子なので訳さない。
    label: item.type === "APP1" ? I18n.t("result.app1Label") : item.type,
    bytes: I18n.formatNumber(item.bytes)
  })).join(I18n.t("list.separator"));
  const head = removed ? I18n.t("result.removedList", { list: removed }) : I18n.t("result.removedNone");
  const sizes = I18n.t("result.sizes", {
    before: I18n.formatNumber(summary.beforeBytes),
    after: I18n.formatNumber(summary.afterBytes)
  });
  return [head, sizes, I18n.t("result.pixelsUnchanged")].join(I18n.t("text.sentenceJoin"));
}
