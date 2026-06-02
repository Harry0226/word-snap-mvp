const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const builtinSource = fs.readFileSync("word-data/builtin-word-lists.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(builtinSource, sandbox);

const lists = sandbox.window.WORD_SNAP_BUILTIN_LISTS || [];
const expected = [
  { grade: "高一", source: "高一内置词库", count: 982, first: "adventurous", last: "trend" },
  { grade: "高二", source: "高二内置词库", count: 779, first: "Southeast", last: "years later" },
  { grade: "高三", source: "高三高频词库", count: 730, first: "contemporary", last: "solution" }
];

for (const deck of expected) {
  const list = lists.find((item) => item.grade === deck.grade);
  assert(list, `${deck.grade} builtin list should exist`);
  assert.strictEqual(list.source, deck.source, `${deck.grade} source name should stay stable`);
  assert.strictEqual(JSON.stringify(list.goals), JSON.stringify([deck.grade]), `${deck.grade} goals should only include its own stage`);
  assert.strictEqual(list.words.length, deck.count, `${deck.grade} should be replaced by the 5.26 updated deck`);
  assert.strictEqual(list.words[0].en, deck.first, `${deck.grade} first word should come from the 5.26 file`);
  assert.strictEqual(list.words.at(-1).en, deck.last, `${deck.grade} last word should come from the 5.26 file`);
}

assert(app.includes("BUILTIN_SEED_VERSION = 14"), "builtin seed version should be bumped for senior deck replacement");
assert(app.includes("Number(seedMeta?.value || 0) < 11"), "existing browsers should reseed the senior deck update");
assert(app.includes('{ grade: "高一", source: "高一内置词库" }'), "old 高一 builtin words should be cleared before reseeding");
assert(app.includes('{ grade: "高二", source: "高二内置词库" }'), "old 高二 builtin words should be cleared before reseeding");
assert(app.includes('{ grade: "高三", source: "高三高频词库" }'), "old 高三 builtin words should be cleared before reseeding");

console.log("senior word list update checks passed");
