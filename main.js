const fileInput = document.getElementById("fileInput");
const metaInfo = document.getElementById("metaInfo");
const cleanButton = document.getElementById("cleanButton");

let originalImageBlob = null;

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  metaInfo.innerHTML = "<p>メタ情報を解析中...</p>";
  cleanButton.disabled = true;

  const arrayBuffer = await file.arrayBuffer();
  const tags = ExifReader.load(arrayBuffer);
  const entries = Object.entries(tags);

  if (entries.length === 0) {
    metaInfo.innerHTML = "<p>メタ情報は見つかりませんでした。</p>";
  } else {
    metaInfo.innerHTML = "<h3>メタ情報</h3><ul>" +
      entries.map(([key, val]) =>
        `<li><strong>${key}</strong>: ${val.description || JSON.stringify(val.value)}</li>`
      ).join("") + "</ul>";
    cleanButton.disabled = false;
  }

  originalImageBlob = file;
});

cleanButton.addEventListener("click", () => {
  if (!originalImageBlob) return;

  const img = new Image();
  const url = URL.createObjectURL(originalImageBlob);
  img.src = url;

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cleaned-image.jpg";
      a.click();
    }, "image/jpeg", 0.95);
  };
});
