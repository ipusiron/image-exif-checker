const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "../main.js"), "utf8");

test("CSP: self-hosted scripts, no ineffective meta frame-ancestors or unsafe-inline", () => {
  const meta = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  assert.ok(meta);
  assert.match(meta[1], /script-src 'self';/);
  assert.match(meta[1], /connect-src 'none';/);
  assert.doesNotMatch(meta[1], /frame-ancestors|unsafe-inline|cdn\.jsdelivr\.net/);
  assert.match(html, /<meta name="referrer" content="no-referrer"/);
  assert.match(html, /<noscript>[^<]*JavaScript[^<]*<\/noscript>/);
});
test("HTML: no inline handlers/styles, external scripts, modules or missing favicon", () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=|\sstyle\s*=|type=["']module["']|href=["']favicon\.ico/i);
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(match => match[0]);
  assert.equal(scripts.length, 3);
  ["vendor/exifreader/exif-reader.min.js", "exif-logic.js", "main.js"].forEach((src, index) => {
    assert.ok(scripts[index].includes('src="' + src + '"'));
    assert.match(scripts[index], /\sdefer(?:\s|>)/);
  });
  assert.doesNotMatch(main, /innerHTML|document\.write|\.style\.color|localStorage|fetch\s*\(|XMLHttpRequest|top\.location/);
});
test("HTML: balanced tags reject orphan closing tags", () => {
  const stack = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "wbr"]);
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const match of stripped.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    const name = match[2].toLowerCase();
    if (match[1]) assert.equal(stack.pop(), name, "closing " + name);
    else if (!voidTags.has(name)) stack.push(name);
  }
  assert.deepEqual(stack, []);
});
test("HTML: required ids are unique, labels and live regions are associated", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["dropZone", "fileInput", "metaInfo", "cleanButton", "filenameInput", "fileExtensionLabel"]) {
    assert.ok(ids.includes(id), id);
  }
  assert.match(html, /<label for="fileInput">/);
  assert.match(html, /<label for="filenameInput">/);
  assert.match(html, /id="metaInfo"[^>]*aria-live="polite"/);
  assert.match(html, /id="dropZone"[^>]*role="button"[^>]*tabindex="0"/);
});
test("HTML: lossless default in fieldset, main and footer exist", () => {
  assert.match(html, /<fieldset[^>]*>[\s\S]*?<legend>削除方式<\/legend>/);
  const radios = [...html.matchAll(/<input\b[^>]*type="radio"[^>]*>/g)].map(match => match[0]);
  assert.equal(radios.length, 2);
  assert.ok(radios.find(tag => tag.includes('value="lossless"')).includes("checked"));
  assert.match(html, /<main>/);
  assert.match(html, /class="site-footer"/);
  assert.match(html, /href="https:\/\/github.com\/ipusiron\/image-exif-checker"/);
});
test("HTML: both removal methods disclose their limits", () => {
  assert.ok(html.includes("すべての隠し情報の消去は保証しません"));
  assert.ok(html.includes("JPEGのSOS以降を保持"));
  assert.ok(html.includes("画素内の隠し情報が残る場合"));
  assert.doesNotMatch(html, /メタ情報以外に埋め込まれたデータも消える/);
});

test("package and workflow use dependency-free Node 22 tests", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
  assert.equal(pkg.name, "image-exif-checker");
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.scripts, { test: "node --test" });
  for (const key of ["type", "dependencies", "devDependencies"]) assert.equal(pkg[key], undefined);
  const workflow = fs.readFileSync(path.join(__dirname, "../.github/workflows/test.yml"), "utf8");
  for (const text of ["push:", "pull_request:", "contents: read", "actions/checkout@v4",
    "actions/setup-node@v4", "node-version: 22", "run: npm test"]) assert.ok(workflow.includes(text), text);
});
