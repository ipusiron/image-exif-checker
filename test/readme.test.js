const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const logic = require("../exif-logic.js");
const reader = require("../vendor/exifreader/exif-reader.min.js");
const root = path.join(__dirname, "..");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

test("README: HTML-comment YAML, key order and block lists", () => {
  const metadata = readme.match(/^<!--\r?\n---\r?\n([\s\S]+?)\r?\n---\r?\n-->/);
  assert.ok(metadata);
  const keys = [...metadata[1].matchAll(/^(\w+):/gm)].map(match => match[1]);
  assert.deepEqual(keys, ["id", "slug", "title", "subtitle_ja", "subtitle_en", "description_ja", "description_en",
    "category_ja", "category_en", "difficulty", "tags", "repo_url", "demo_url", "hub"]);
  for (const key of ["category_ja", "category_en", "tags"]) {
    assert.match(metadata[1], new RegExp("^" + key + ":\\r?\\n  - ", "m"));
  }
  for (const [key, expected] of Object.entries({
    id: "day007", slug: "image-exif-checker", repo_url: "https://github.com/ipusiron/image-exif-checker",
    demo_url: "https://ipusiron.github.io/image-exif-checker/", hub: "true"
  })) {
    const value = metadata[1].match(new RegExp("^" + key + ": (.+)$", "m"))?.[1].replace(/^"|"$/g, "").trim();
    assert.equal(value, expected, key);
  }
});
test("README: sample size table is recomputed from actual binary removal", () => {
  const rows = [...readme.matchAll(/^\| test\/test_sensitive\.jpg \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \|$/gm)];
  assert.equal(rows.length, 1, "numeric example table must exist");
  const before = fs.readFileSync(path.join(__dirname, "test_sensitive.jpg"));
  const after = logic.stripJpegMetadata(before);
  const values = rows[0].slice(1).map(value => Number(value.replaceAll(",", "")));
  assert.deepEqual(values, [before.length, after.length, before.length - after.length]);
  assert.deepEqual(values, [2818, 2509, 309]);
});
test("README: every example tag is actually sensitive and sample has 11 sensitive tags", () => {
  const table = readme.match(/### 🧹 機微タグとして強調する主な情報\r?\n([\s\S]*?)\r?\n\r?\n/);
  assert.ok(table);
  const tags = [...table[1].matchAll(/`([^`]+)`/g)].map(match => match[1]);
  assert.ok(tags.length >= 10);
  for (const tag of tags) assert.equal(logic.isSensitiveTag(tag), true, tag);
  const bytes = fs.readFileSync(path.join(__dirname, "test_sensitive.jpg"));
  const data = reader.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(Object.keys(data).length, 18);
  assert.equal(logic.countSensitiveTags(data), 11);
  assert.ok(readme.includes("機微タグ11件"));
});
test("README: five centered local images exist", () => {
  const paths = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)|<img\b[^>]*src="([^"]+)"/g)]
    .map(match => match[1] || match[2]).filter(src => !/^https?:\/\//.test(src));
  assert.equal(paths.length, 5);
  assert.equal(new Set(paths).size, 5);
  for (const src of paths) assert.ok(fs.existsSync(path.join(root, src)), src);
  assert.equal([...readme.matchAll(/<p align="center">\s*<img /g)].length, 5);
});
test("README: project identity, sections, license and no old artifacts", () => {
  assert.ok(readme.includes("Day007 - 生成AIで作るセキュリティツール100"));
  assert.ok(readme.includes("https://akademeia.info/?page_id=42163"));
  assert.doesNotMatch(readme, /ブラウザ(?!ー)|ツール200|page_id=44607|以下は、.*追加する|出力はJPEGファイルになります/);
  assert.doesNotMatch(readme, /^#{2,} .*：$/m);
  assert.match(readme, /\[MITライセンス\]\(\.\/LICENSE\)/);
  assert.equal(fs.readFileSync(path.join(root, "LICENSE"), "utf8").split(/\r?\n/)[0], "MIT License");
  assert.ok(readme.includes("MPL-2.0"));
  const expected = ["🌐 デモページ", "📸 スクリーンショット", "✨ 機能", "📖 使い方", "📐 画面構成", "🎯 ユースケース",
    "🔬 技術的な説明", "🔒 セキュリティ", "⚠️ 注意", "🧪 テスト", "❓ FAQ", "🔗 参考", "📁 ディレクトリー構造",
    "💻 動作環境", "📄 ライセンス", "🛠️ このツールについて"];
  assert.deepEqual([...readme.matchAll(/^## (.+)$/gm)].map(match => match[1]), expected);
});
test("README: standard PNG chunks and removal limits agree with the approved specification", () => {
  for (const text of ["標準のeXIfチャンク", "mDCV", "cLLI", "すべての隠し情報の消去は保証しません",
    "最初のSOS以降をそのまま保持", "ステガノグラフィー", "https://www.w3.org/TR/png-3/"]) {
    assert.ok(readme.includes(text), text);
  }
  assert.doesNotMatch(readme, /PNGはExifが標準ではない|mDCv|cLLi/);
});

test("Notebook: valid JSON with unchanged original code", () => {
  const notebook = JSON.parse(fs.readFileSync(path.join(__dirname, "generate_test_exif_image.ipynb"), "utf8"));
  assert.equal(notebook.nbformat, 4);
  const cells = notebook.cells.filter(cell => cell.cell_type === "code");
  assert.ok(cells.length > 0);
  const source = cells.map(cell => cell.source.join("")).join("");
  assert.equal(sha256(source), "f3bc7348abcb52f3e3af4220801ef4d64a0b2261d5cceddfeb680943ee7ff670");
  assert.ok(cells.every(cell => cell.outputs.length === 0));
});
test("Vendor: exact ExifReader 4.12.0 distribution and MPL-2.0 license", () => {
  const js = fs.readFileSync(path.join(root, "vendor/exifreader/exif-reader.min.js"));
  assert.equal(js.length, 68450);
  assert.equal(sha256(js), "fa388e973a8280d360ac833588a084cbf856b41de51169b533b306f59b8cc110");
  assert.equal(createHash("sha384").update(js).digest("base64"),
    "VJo1YHT8HkmsAAS/wcvuuXkB85afkNQ12wUadP2Cm/Ni5lJki4w/WqHb1coG6l1L");
  assert.equal(sha256(fs.readFileSync(path.join(root, "vendor/exifreader/LICENSE"))),
    "3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04");
  const credit = fs.readFileSync(path.join(root, "vendor/exifreader/README.md"), "utf8");
  for (const text of ["4.12.0", "MPL-2.0", "https://cdn.jsdelivr.net/npm/exifreader@4.12.0/dist/exif-reader.min.js",
    "https://github.com/mattiasw/ExifReader", "SHA-384", "SHA-256"]) assert.ok(credit.includes(text), text);
});
