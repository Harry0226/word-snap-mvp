const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const stageSandbox = { window: {} };
vm.createContext(stageSandbox);
vm.runInContext(fs.readFileSync(path.join(root, "word-data", "builtin-manifest.js"), "utf8"), stageSandbox);
const manifestStages = stageSandbox.window.WORD_SNAP_BUILTIN_MANIFEST.stages;
for (const entry of Object.values(manifestStages)) {
  const filename = entry.src.match(/stages\/([^?]+)/)[1];
  vm.runInContext(fs.readFileSync(path.join(root, "word-data", "stages", filename), "utf8"), stageSandbox);
}

for (const [grade, entry] of Object.entries(manifestStages)) {
  const list = stageSandbox.window.WORD_SNAP_STAGE_LISTS[grade];
  assert(list, `${grade} stage asset should exist`);
  assert.strictEqual(list.words.length, entry.count, `${grade} stage asset should match its manifest count`);
}

console.log("stage asset integrity checks passed");
