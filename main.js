const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const metaInfo = document.getElementById("metaInfo");
const cleanButton = document.getElementById("cleanButton");
const filenameInput = document.getElementById("filenameInput");
const extensionLabel = document.getElementById("fileExtensionLabel");
const cleaningModes = document.getElementById("cleaningModes");
const resultInfo = document.getElementById("resultInfo");

let originalImageBlob = null;
let originalMimeType = "image/jpeg";
let originalExtension = ".jpg";
let originalBytes = null;
let originalFormat = null;
let busy = false;

const unreadableMessage = "画像を読み取れませんでした。ファイルが壊れている可能性があります。";
const unsupportedMessage = "この形式には対応していません。JPEG（.jpg / .jpeg）または PNG（.png）を選んでください。";

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
  metaInfo.textContent = "メタ情報を解析中...";
  resultInfo.textContent = "";

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const format = ExifLogic.detectImageFormat(bytes);
    if (!format) throw new Error(unsupportedMessage);

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
    renderMetadata(tags);

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
    metaInfo.textContent = error.message === unsupportedMessage ? unsupportedMessage : unreadableMessage;
  } finally {
    setBusy(false);
  }
}

function renderMetadata(tags) {
  const entries = Object.entries(tags);
  const count = ExifLogic.countSensitiveTags(tags);
  metaInfo.replaceChildren();
  const summary = document.createElement("p");
  summary.className = "risk-summary";
  summary.textContent = count > 0
    ? "情報漏洩リスクのある項目が " + count + " 件見つかりました"
    : "情報漏洩リスクのある項目は見つかりませんでした";
  metaInfo.appendChild(summary);
  if (entries.length === 0) {
    const message = document.createElement("p");
    message.textContent = "メタ情報は見つかりませんでした。";
    metaInfo.appendChild(message);
    return;
  }

  // XSS対策: DOM APIを使用して安全に要素を構築
  const h3 = document.createElement("h3");
  h3.textContent = "メタ情報";
  metaInfo.appendChild(h3);
  const ul = document.createElement("ul");
  entries.forEach(([key, val]) => {
    const isSensitive = ExifLogic.isSensitiveTag(key);
    const li = document.createElement("li");
    li.dataset.tag = key;
    const keyStrong = document.createElement("strong");
    if (isSensitive) keyStrong.classList.add("sensitive");
    keyStrong.textContent = key;
    const displayValue = ExifLogic.formatTagValue(val);
    li.appendChild(keyStrong);
    li.appendChild(document.createTextNode((isSensitive ? "（注意）" : "") + ": " + displayValue));
    ul.appendChild(li);
  });
  metaInfo.appendChild(ul);
}

// Exifを除去して保存（元形式）
cleanButton.addEventListener("click", async () => {
  if (busy || !originalImageBlob) return;
  setBusy(true);
  resultInfo.textContent = "メタ情報を削除中...";
  try {
    const method = document.querySelector('input[name="cleanMethod"]:checked').value;
    let blob;
    let description;
    if (method === "lossless") {
      const cleaned = ExifLogic.stripMetadata(originalBytes, originalFormat);
      const summary = ExifLogic.summarizeStrip(originalBytes, cleaned, originalFormat);
      blob = new Blob([cleaned], { type: originalMimeType });
      description = describeStrip(summary);
    } else {
      blob = await reencodeImage(originalImageBlob, originalMimeType);
      description = "完全再エンコードで画像を保存します。";
    }
    const output = await blob.arrayBuffer();
    let verification;
    try {
      const remaining = ExifLogic.countSensitiveTags(ExifReader.load(output));
      verification = remaining === 0
        ? "残っている項目: 0 件（画像の幅・高さなど構造の情報のみ）"
        : "残っている機微タグ: " + remaining + " 件。保存した画像を確認してください。";
    } catch {
      verification = "メタ情報は残っていません（機微タグ 0 件）。";
    }
    resultInfo.textContent = description + "\n" + verification;
    await downloadBlob(blob, ExifLogic.buildDownloadName(filenameInput.value, originalFormat));
  } catch {
    resultInfo.textContent = "画像を保存できませんでした。別の画像か削除方式を選んで、もう一度お試しください。";
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
      reject(new Error(unreadableMessage));
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
  if (!ctx) throw new Error("画像の描画に失敗しました。");
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    const complete = output => output ? resolve(output) : reject(new Error("画像の生成に失敗しました。"));
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
  const removed = summary.removed.map(item => {
    const label = item.type === "APP1" ? "APP1（Exifなど）" : item.type;
    return label + " " + item.bytes.toLocaleString("ja-JP") + "バイト";
  }).join("、");
  const sizes = summary.beforeBytes.toLocaleString("ja-JP") + " → " + summary.afterBytes.toLocaleString("ja-JP");
  return (removed ? removed + "を除去しました。" : "除去対象のメタ情報はありませんでした。")
    + sizes + "バイト。画素データは変更していません。";
}
