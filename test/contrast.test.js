const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const css = fs.readFileSync(path.join(__dirname, "../style.css"), "utf8");

function variables(block) {
  assert.ok(block, "CSS variable block exists");
  const entries = [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)];
  assert.equal(entries.length, 19, "all semantic color tokens exist in each theme");
  for (const [, name, value] of entries) assert.match(value, /^#[0-9a-f]{6}$/i, name);
  return Object.fromEntries(entries.map(([, name, value]) => [name, value]));
}
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function ratio(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const light = variables(css.match(/:root\s*\{([^}]+)\}/)?.[1]);
const dark = variables(css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]+)\}/)?.[1]);
const textPairs = [
  ["text", "background"], ["text", "surface"], ["heading", "background"],
  ["muted", "background"], ["muted", "surface"], ["sensitive", "surface"],
  ["button-text", "button"], ["disabled-text", "disabled"],
  ["drop-text", "drop-background"], ["drag-text", "drag-background"], ["link", "background"]
];
const nonTextPairs = [
  ["border", "surface"], ["border", "background"], ["drop-border", "drop-background"],
  ["drag-border", "drag-background"], ["focus", "background"], ["focus", "surface"],
  ["focus", "drop-background"], ["button", "surface"]
];
for (const [theme, colors] of [["light", light], ["dark", dark]]) {
  for (const [pairs, threshold] of [[textPairs, 4.5], [nonTextPairs, 3]]) {
    for (const [fg, bg] of pairs) {
      test(`${theme}: ${fg}/${bg} >= ${threshold}:1`, () => {
        assert.ok(colors["--" + fg], fg);
        assert.ok(colors["--" + bg], bg);
        const actual = ratio(colors["--" + fg], colors["--" + bg]);
        assert.ok(actual >= threshold, actual.toFixed(4));
      });
    }
  }
}
