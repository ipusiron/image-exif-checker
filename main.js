const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const metaInfo = document.getElementById("metaInfo");
const cleanButton = document.getElementById("cleanButton");
const filenameInput = document.getElementById("filenameInput");
const extensionLabel = document.getElementById("fileExtensionLabel");

let originalImageBlob = null;
let originalMimeType = "image/jpeg";
let originalExtension = ".jpg";

// 情報漏洩リスクの高いExifタグ（大文字に統一）
const sensitiveTags = new Set([
  "GPSLATITUDE", "GPSLONGITUDE", "GPSALTITUDE",
  "DATETIMEORIGINAL", "CREATEDATE", "MODIFYDATE",
  "MAKE", "MODEL", "SOFTWARE",
  "ARTIST", "OWNERNAME", "COPYRIGHT",
  "SERIALNUMBER", "USERCOMMENT", "IMAGEUNIQUEID"
]);

// ファイル選択時
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
});

// ドラッグ＆ドロップ対応
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
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
  metaInfo.innerHTML = "<p>メタ情報を解析中...</p>";
  cleanButton.disabled = true;

  const arrayBuffer = await file.arrayBuffer();
  const tags = ExifReader.load(arrayBuffer);
  const entries = Object.entries(tags);

  if (entries.length === 0) {
    metaInfo.textContent = "メタ情報は見つかりませんでした。";
  } else {
    // XSS対策: DOM APIを使用して安全に要素を構築
    metaInfo.innerHTML = "";
    const h3 = document.createElement("h3");
    h3.textContent = "メタ情報";
    metaInfo.appendChild(h3);

    const ul = document.createElement("ul");
    entries.forEach(([key, val]) => {
      const isSensitive = sensitiveTags.has(key.toUpperCase());
      const li = document.createElement("li");

      const keyStrong = document.createElement("strong");
      if (isSensitive) {
        keyStrong.style.color = "red";
      }
      keyStrong.textContent = key;

      const displayValue = val.description || JSON.stringify(val.value);

      li.appendChild(keyStrong);
      li.appendChild(document.createTextNode(": " + displayValue));
      ul.appendChild(li);
    });
    metaInfo.appendChild(ul);
    cleanButton.disabled = false;
  }

  originalImageBlob = file;
  originalMimeType = file.type;
  originalExtension = originalMimeType === "image/png" ? ".png" : ".jpg";

  // 拡張子なしファイル名をセット
  const originalName = file.name.replace(/\.[^/.]+$/, "");
  filenameInput.value = originalName;
  extensionLabel.textContent = originalExtension;
}

// Exifを除去して保存（元形式）
cleanButton.addEventListener("click", () => {
  if (!originalImageBlob) return;

  const img = new Image();
  const url = URL.createObjectURL(originalImageBlob);
  img.src = url;

  const filenameRaw = filenameInput.value.trim() || "cleaned-image";
  const mime = originalMimeType;
  const ext = originalExtension;

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filenameRaw.endsWith(ext) ? filenameRaw : filenameRaw + ext;
      a.click();
    }, mime, mime === "image/jpeg" ? 0.95 : undefined);
  };
});
