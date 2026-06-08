const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const sourceSandbox = { window: {} };
vm.createContext(sourceSandbox);
for (const filename of ["builtin-word-lists.js", "junior-exam-words.js", "phrase-review-words.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "word-data", filename), "utf8"), sourceSandbox);
}

const expected = new Map([
  ["初三", sourceSandbox.window.WORD_SNAP_WORDS.length],
  ["中考常考词组总复习", sourceSandbox.window.WORD_SNAP_PHRASE_REVIEW_WORDS.length],
  ...sourceSandbox.window.WORD_SNAP_BUILTIN_LISTS.map((list) => [list.grade, list.words.length])
]);

const stageSandbox = { window: {} };
vm.createContext(stageSandbox);
vm.runInContext(fs.readFileSync(path.join(root, "word-data", "builtin-manifest.js"), "utf8"), stageSandbox);
for (const entry of Object.values(stageSandbox.window.WORD_SNAP_BUILTIN_MANIFEST.stages)) {
  const filename = entry.src.match(/stages\/([^?]+)/)[1];
  vm.runInContext(fs.readFileSync(path.join(root, "word-data", "stages", filename), "utf8"), stageSandbox);
}

for (const [grade, count] of expected) {
  const list = stageSandbox.window.WORD_SNAP_STAGE_LISTS[grade];
  assert(list, `${grade} stage asset should exist`);
  assert.strictEqual(list.words.length, count, `${grade} stage asset should preserve every word`);
}

console.log("stage asset integrity checks passed");
