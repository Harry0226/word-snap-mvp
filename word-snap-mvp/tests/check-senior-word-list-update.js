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
  { grade: "高一", source: "高一内置词库", count: 2140, includes: ["available", "adventurous", "trend"] },
  { grade: "高二", source: "高二内置词库", count: 1019, includes: ["produce", "Southeast", "years later"] },
  { grade: "高三", source: "高三高频词库", count: 730, first: "contemporary", last: "solution" }
];

for (const deck of expected) {
  const list = lists.find((item) => item.grade === deck.grade);
  assert(list, `${deck.grade} builtin list should exist`);
  assert.strictEqual(list.source, deck.source, `${deck.grade} source name should stay stable`);
  assert.strictEqual(JSON.stringify(list.goals), JSON.stringify([deck.grade]), `${deck.grade} goals should only include its own stage`);
  assert.strictEqual(list.words.length, deck.count, `${deck.grade} should be replaced by the 5.26 updated deck`);
  if (deck.includes) {
    for (const en of deck.includes) assert(list.words.some((word) => word.en === en), `${deck.grade} should include ${en}`);
  } else {
    assert.strictEqual(list.words[0].en, deck.first, `${deck.grade} first word should come from the 5.26 file`);
    assert.strictEqual(list.words.at(-1).en, deck.last, `${deck.grade} last word should come from the 5.26 file`);
  }
}

const seniorOne = lists.find((item) => item.grade === "高一");
const seniorTwo = lists.find((item) => item.grade === "高二");
for (const list of [seniorOne, seniorTwo]) {
  assert.strictEqual(new Set(list.words.map((word) => word.en.toLowerCase())).size, list.words.length, `${list.grade} should be deduped by English text`);
  const firstLetters = list.words.slice(0, 30).map((word) => word.en[0].toLowerCase()).join("");
  assert.notStrictEqual(firstLetters, [...firstLetters].sort().join(""), `${list.grade} should be shuffled rather than alphabetized by first letter`);
}

assert(app.includes("BUILTIN_SEED_VERSION = 15"), "builtin seed version should be bumped for 2026 final-term senior deck update");
assert(app.includes("hasBuiltinWords"), "seed logic should recover when local builtin words are unexpectedly empty");
assert(app.includes("Number(seedMeta?.value || 0) < 14"), "existing browsers should reseed the 2026 final-term senior deck update");
assert(app.includes("Number(seedMeta?.value || 0) < 11"), "existing browsers should reseed the senior deck update");
assert(app.includes('{ grade: "高一", source: "高一内置词库" }'), "old 高一 builtin words should be cleared before reseeding");
assert(app.includes('{ grade: "高二", source: "高二内置词库" }'), "old 高二 builtin words should be cleared before reseeding");
assert(app.includes('{ grade: "高三", source: "高三高频词库" }'), "old 高三 builtin words should be cleared before reseeding");

console.log("senior word list update checks passed");
