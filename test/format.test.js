const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
// Third-party minified vendor files are intentionally excluded.
const files = ["exif-logic.js", "main.js", "style.css", "index.html",
  ...fs.readdirSync(__dirname).filter(name => name.endsWith(".test.js")).map(name => "test/" + name)];
const minimum = { "exif-logic.js": 150, "main.js": 150, "style.css": 100, "index.html": 90 };
for (const file of files) {
  test("readable multi-line formatting: " + file, () => {
    const lines = fs.readFileSync(path.join(root, file), "utf8").trimEnd().split(/\r?\n/);
    const limit = file === "index.html" ? 250 : 160;
    for (const [index, line] of lines.entries()) {
      assert.ok(line.length <= limit, `${file}:${index + 1} has ${line.length} characters (limit ${limit})`);
    }
    if (minimum[file]) assert.ok(lines.length >= minimum[file], `${file} must not be minified`);
  });
}
