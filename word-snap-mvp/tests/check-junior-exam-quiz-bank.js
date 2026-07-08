const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

assert(!index.includes('src="./word-data/quiz-sentences.js?v='), "index should not block first paint with the junior exam quiz bank");
assert(!index.includes('value="enToZhType"'), "training mode should not include 看英文说中文");
assert(!index.includes('value="zhToEnType"'), "training mode should not include 看中文说英文");
assert(index.includes('value="zhToEnChoice"'), "training mode should keep 看中文选英文");
assert(index.includes('value="enToZhChoice"'), "training mode should keep 看英文选中文");
assert(index.includes('value="auto">智能双选</option>'), "training mode should rename auto to 智能双选");
assert(index.includes('<option value="all">全部 340 题</option>'), "initial 初三 quiz size copy should show 340 questions");

assert(app.includes('if (grade === "初三") return window.WORD_SNAP_QUIZ_SENTENCES || [];'), "初三 should read the dedicated sentence quiz bank");
assert(app.includes('"初三": "./word-data/quiz-sentences.js?v='), "初三 quiz bank should be lazily loadable with a versioned URL");
assert(app.includes("updateQuizSizeOptions();"), "initial page load should refresh quiz size options from loaded data");
assert(!app.includes("zhToEnType"), "app should not keep the removed speaking/typing English mode");
assert(!app.includes("enToZhType"), "app should not keep the removed speaking/typing Chinese mode");
assert(!app.includes("typingPanel"), "typing panel should be removed from training logic");
assert(app.includes('Math.random() < 0.5 ? "zhToEnChoice" : "enToZhChoice"'), "智能双选 should only rotate between the two choice modes");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("word-data/quiz-sentences.js", "utf8"), sandbox);

const bank = sandbox.window.WORD_SNAP_QUIZ_SENTENCES || [];
assert.strictEqual(bank.length, 340, "初三刷题题库 should include all 340 parsed questions");

const sources = new Set(bank.map((q) => q.source));
["中考题库更新1", "中考题库更新2", "中考题库更新3", "中考题库更新4"].forEach((source) => {
  assert(sources.has(source), `${source} should be included`);
});

for (const q of bank) {
  assert.strictEqual(q.grade, "初三", `${q.id} should target 初三`);
  assert(q.id && q.sentence && q.answer, `${q.id || "unknown"} should include id, sentence, and answer`);
  assert(Array.isArray(q.options), `${q.id} should include options`);
  assert.strictEqual(q.options.length, 5, `${q.id} should have exactly 5 options`);
  assert.strictEqual(new Set(q.options.map((x) => String(x).toLowerCase())).size, 5, `${q.id} options should be unique`);
  assert.strictEqual(q.options.filter((x) => String(x).toLowerCase() === String(q.answer).toLowerCase()).length, 1, `${q.id} should include the correct answer exactly once`);
}

const expectedSamples = [
  ["exam2-002", "rules"],
  ["exam2-003", "helmets"],
  ["exam2-004", "riding"],
  ["exam2-005", "busier"],
  ["exam3-004", "lifted"],
  ["exam3-011", "facts"]
];

for (const [id, answer] of expectedSamples) {
  const item = bank.find((q) => q.id === id);
  assert(item, `${id} should exist`);
  assert.strictEqual(item.answer, answer, `${id} should keep the corrected answer`);
}

console.log("junior exam quiz bank checks passed");
