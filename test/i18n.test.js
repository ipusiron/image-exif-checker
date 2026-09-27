const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const I18n = require(path.join(root, "i18n.js"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const main = fs.readFileSync(path.join(root, "main.js"), "utf8");
const logic = fs.readFileSync(path.join(root, "exif-logic.js"), "utf8");
// gフラグは付けない。lastIndexが残り、ループで交互にfalseになる。
const japanese = /[぀-ヿ一-鿿]/;
const commentLine = /^\s*(\/\/|\/\*|\*)/;

test("i18n: 日本語と英語でキーの集合が同じ", () => {
  assert.deepEqual(Object.keys(I18n.ja).filter(key => !(key in I18n.en)), [], "英語に無いキー");
  assert.deepEqual(Object.keys(I18n.en).filter(key => !(key in I18n.ja)), [], "日本語に無いキー");
  assert.equal(Object.keys(I18n.ja).length, 46);
});

test("i18n: 差し込みの名前が日本語と英語で一致する", () => {
  const holes = value => [...String(value).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(",");
  assert.deepEqual(Object.keys(I18n.ja).filter(key => holes(I18n.ja[key]) !== holes(I18n.en[key])), []);
});

test("i18n: index.html が指すキーはすべて辞書にある", () => {
  const keys = new Set();
  for (const match of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size >= 20, "data-i18n が少なすぎる: " + keys.size);
  assert.deepEqual([...keys].filter(key => !(key in I18n.ja)), []);
});

test("i18n: スクリプトが呼ぶキーはすべて辞書にある", () => {
  const keys = new Set();
  for (const source of [main, logic]) {
    for (const match of source.matchAll(/["']([a-z][A-Za-z]*\.[A-Za-z][A-Za-z0-9]*)["']/g)) keys.add(match[1]);
  }
  assert.ok(keys.size >= 20, "文言キーが少なすぎる: " + keys.size);
  assert.deepEqual([...keys].filter(key => !(key in I18n.ja)), []);
  for (const key of ["status.analyzing", "error.unsupported", "value.unavailable", "verify.clean"]) {
    assert.ok(keys.has(key), key);
  }
});

test("i18n: 英語の辞書に訳し忘れの日本語が残っていない", () => {
  // 言語の切り替えボタンだけは、相手の言語を出すのが正しい
  const allowed = new Set(["app.langButton"]);
  const left = Object.keys(I18n.en).filter(key => !allowed.has(key) && japanese.test(I18n.en[key]));
  assert.deepEqual(left, []);
});

test("i18n: t() は差し込みを埋め、知らないキーで throw する", () => {
  assert.equal(I18n.t("risk.found", { count: 3 }), "情報漏洩リスクのある項目が 3 件見つかりました");
  assert.equal(I18n.t("value.truncated", { count: 201 }), "…（全 201 文字）");
  assert.equal(I18n.t("list.separator"), "、");
  assert.equal(I18n.t("text.sentenceJoin"), "");
  assert.throws(() => I18n.t("no.such.key"), /Unknown message/);
});

test("i18n: 状態の判定を表示中の文言で行っていない", () => {
  assert.doesNotMatch(main, /unreadableMessage|unsupportedMessage/);
  assert.doesNotMatch(main, /textContent\s*===|textContent\.includes/);
  assert.match(main, /ExifLogic\.ERROR_CODES\.unsupportedFormat/);
  assert.match(main, /metaState\.kind/);
  assert.match(main, /resultState\.kind/);
});

test("i18n: 言語を変えても表示中の状態を訳し直せる", () => {
  // 一時的な表示（解析中・削除中）と結果は、キーと値で保持してから描き直す
  assert.match(main, /languagechange["']\s*,\s*\(\)\s*=>\s*\{\s*renderMeta\(\);\s*renderResult\(\);/);
  assert.match(main, /kind:\s*"status",\s*key:\s*"status\.analyzing"/);
  assert.match(main, /kind:\s*"status",\s*key:\s*"status\.cleaning"/);
  assert.match(main, /kind:\s*"done",\s*summary,\s*verify/);
});

test("i18n: 子要素を持つ要素に data-i18n を付けていない", () => {
  for (const match of html.matchAll(/<(\w+)[^>]*\sdata-i18n="[^"]+"[^>]*>([\s\S]*?)<\/\1>/g)) {
    assert.doesNotMatch(match[2], /</, match[1] + " の中身に要素がある: " + match[2].slice(0, 40));
  }
});

test("i18n: 本文に残る和文は切り替えボタンの読み上げと noscript だけ", () => {
  const body = html.slice(html.indexOf("<body>"));
  const left = body.split(/\r?\n/).filter(line => japanese.test(line) && !/data-i18n/.test(line));
  assert.deepEqual(left.map(line => line.trim()), [
    'aria-label="言語を切り替える">English</button>',
    "<noscript>This tool requires JavaScript. / このツールの利用にはJavaScriptが必要です。</noscript>"
  ]);
});

test("i18n: 和文を含む meta は data-i18n-content を持つ", () => {
  const metas = [...html.matchAll(/<meta\b[^>]*\/>/g)].map(match => match[0]);
  assert.ok(metas.length >= 12, "meta が少なすぎる: " + metas.length);
  for (const meta of metas.filter(tag => japanese.test(tag))) {
    assert.match(meta, /data-i18n-content="[^"]+"/, meta.slice(0, 60));
  }
  // title だけは要素なので data-i18n では置き換えず、apply() が書き換える
  assert.match(html, /<title>[^<]*画像Exif[^<]*<\/title>/);
});

test("i18n: 純ロジックとDOM層に和文の文言が無い（注記は除く）", () => {
  for (const [name, source] of [["main.js", main], ["exif-logic.js", logic]]) {
    const left = source.split(/\r?\n/)
      .map((line, index) => [index + 1, line])
      .filter(([, line]) => japanese.test(line) && !commentLine.test(line));
    assert.deepEqual(left, [], name + " に和文の文言が残っている");
  }
});

test("i18n: 言語の保存は i18n.js だけが行う", () => {
  assert.doesNotMatch(main, /localStorage/);
  assert.doesNotMatch(logic, /localStorage/);
  const i18n = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
  assert.match(i18n, /localStorage\.setItem\(STORAGE_KEY, value\)/);
  assert.match(i18n, /image-exif-checker-language/);
});

test("i18n: i18n.js を他のスクリプトより先に読み込む", () => {
  const order = ["i18n.js", "vendor/exifreader/exif-reader.min.js", "exif-logic.js", "main.js"]
    .map(src => html.indexOf('<script src="' + src + '"'));
  assert.deepEqual(order.filter(index => index < 0), []);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("i18n: 切り替えボタンの id は langToggle", () => {
  assert.match(html, /id="langToggle"[\s\S]*?data-i18n="app\.langButton"/);
  assert.match(main, /getElementById\("langToggle"\)/);
});

test("i18n: 状態で変わる属性に data-i18n-<attr> を付けない", () => {
  // aria-disabled と aria-busy は setBusy が書く。apply() が上書きすると状態が巻き戻る
  assert.doesNotMatch(html, /id="dropZone"[^>]*data-i18n-aria/);
  assert.doesNotMatch(html, /id="metaInfo"[^>]*data-i18n/);
  assert.match(main, /dropZone\.setAttribute\("aria-disabled"/);
  assert.match(main, /metaInfo\.setAttribute\("aria-busy"/);
});

test("i18n: Exifのタグ名と規格上の識別子は訳さない", () => {
  // タグ名・セグメント名は固有名詞。辞書に持たず、そのまま表示する
  assert.match(main, /keyStrong\.textContent = key;/);
  assert.equal(I18n.ja["result.app1Label"].startsWith("APP1"), true);
  assert.equal(I18n.en["result.app1Label"].startsWith("APP1"), true);
});

test("i18n: README に言語リンクがあり、英語版が存在する", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const english = fs.readFileSync(path.join(root, "README.en.md"), "utf8");
  assert.match(readme, /^\[English\]\(README\.en\.md\) · 日本語$/m);
  assert.match(english, /^English · \[日本語\]\(README\.md\)$/m);
  // YAMLのHTMLコメントはファイル先頭のままにする
  assert.match(readme, /^<!--\r?\n---\r?\n/);
});
