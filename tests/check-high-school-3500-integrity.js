const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ window: {} });
vm.runInContext(
  fs.readFileSync(path.join(root, "word-data", "builtin-manifest.js"), "utf8"),
  context
);

const manifest = context.window.WORD_SNAP_BUILTIN_MANIFEST;
const high3500 = manifest.stages["高中3500刷词专栏"];
const curriculum = manifest.stages["高一课改词库"];
assert(high3500, "manifest should expose 高中3500刷词专栏");
assert(curriculum, "manifest should restore 高一课改词库");
assert.strictEqual(high3500.count, 3515, "the 48 source PDFs contain 3515 rows");
assert.strictEqual(high3500.uniqueCount, 3510, "exact duplicate rows should be audited");
assert.strictEqual(curriculum.count, 298, "the restored curriculum list should keep 298 words");

vm.runInContext(
  fs.readFileSync(path.join(root, high3500.src.replace(/^\.\//, "")), "utf8"),
  context
);
const list = context.window.WORD_SNAP_STAGE_LISTS["高中3500刷词专栏"];
assert(list, "the 高中3500刷词专栏 stage asset should load");
assert.strictEqual(list.words.length, 3515, "all source rows should be retained");
assert.strictEqual(list.listCounts.length, 48, "all 48 lists should be represented");
assert.strictEqual(
  list.listCounts.reduce((sum, count) => sum + count, 0),
  3515,
  "per-list counts should add up to the source total"
);
assert(
  list.words.every((word) => word.en && word.zh && /^List \d+/.test(word.notes)),
  "every word should include English, Chinese, and its source List number"
);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const stage of ["高中3500刷词专栏", "高一课改词库"]) {
  assert.strictEqual(
    (html.match(new RegExp(`<option value="${stage}">`, "g")) || []).length,
    4,
    `${stage} should be available in training, battle, import, and quiz selectors`
  );
}

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert(app.includes('"高中3500刷词专栏"'), "app stage registry should include 高中3500刷词专栏");
assert(app.includes('"高一课改词库"'), "app stage registry should include 高一课改词库");

console.log("high-school 3500 and grade10 curriculum integrity checks passed");
