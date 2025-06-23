const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const metaInfo = document.getElementById('metaInfo');
const cleanButton = document.getElementById('cleanButton');
const filenameInput = document.getElementById('filenameInput');

let originalImageBlob = null;
let originalMimeType = 'image/jpeg'; // デフォルト
let originalExtension = '.jpg'; // デフォルト拡張子

// ファイル選択時
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
});

// ドラッグ＆ドロップ対応
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFile(file);
  }
});

// メタ情報の表示と保存処理の準備
async function handleFile(file) {
  const extensionLabel = document.getElementById('fileExtensionLabel');
  originalMimeType = file.type;
  originalExtension = originalMimeType === 'image/png' ? '.png' : '.jpg';
  extensionLabel.textContent = originalExtension; // 拡張子表示を更新

  metaInfo.innerHTML = '<p>メタ情報を解析中...</p>';
  cleanButton.disabled = true;

  const arrayBuffer = await file.arrayBuffer();
  const tags = ExifReader.load(arrayBuffer);
  const entries = Object.entries(tags);

  if (entries.length === 0) {
    metaInfo.innerHTML = '<p>メタ情報は見つかりませんでした。</p>';
  } else {
    metaInfo.innerHTML =
      '<h3>メタ情報</h3><ul>' +
      entries
        .map(
          ([key, val]) =>
            `<li><strong>${key}</strong>: ${
              val.description || JSON.stringify(val.value)
            }</li>`
        )
        .join('') +
      '</ul>';
    cleanButton.disabled = false;
  }

  originalImageBlob = file;
  originalMimeType = file.type;

  // 拡張子を除いた元のファイル名を初期値に設定
  const originalName = file.name.replace(/\.[^/.]+$/, '');
  filenameInput.value = originalName;

  // 拡張子も保存（念のため）
  originalExtension = originalMimeType === 'image/png' ? '.png' : '.jpg';
}

// メタ情報を削除して保存
cleanButton.addEventListener('click', () => {
  if (!originalImageBlob) return;

  const img = new Image();
  const url = URL.createObjectURL(originalImageBlob);
  img.src = url;

  const filenameRaw = filenameInput.value.trim() || 'cleaned-image';
  const mime = originalMimeType;
  const ext = originalExtension;

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    canvas.toBlob(
      (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filenameRaw.endsWith(ext)
          ? filenameRaw
          : filenameRaw + ext;
        a.click();
      },
      mime,
      mime === 'image/jpeg' ? 0.95 : undefined
    );
  };
});
