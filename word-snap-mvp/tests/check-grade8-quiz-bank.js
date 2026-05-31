const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

assert(!index.includes('src="./word-data/quiz-grade8-sentences.js?v='), "index should not block first paint with the grade 8 quiz bank");
assert(fs.existsSync("word-data/quiz-grade8-sentences.js"), "grade 8 quiz data file should exist");
assert(app.includes("const GRADE8_QUIZ_COUNT = 239;"), "app should pin the grade 8 quiz bank to 239 questions");
assert(app.includes('"初二": "./word-data/quiz-grade8-sentences.js?v='), "app should lazily load the grade 8 quiz bank with a versioned URL");
assert(app.includes('if (grade === "初二") return window.WORD_SNAP_GRADE8_QUIZ_SENTENCES || [];'), "app should read the dedicated grade 8 sentence quiz bank");
assert(app.includes('if (grade === "初二") return GRADE8_QUIZ_COUNT;'), "grade 8 quiz should not fall back to generated builtin questions");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("word-data/quiz-grade8-sentences.js", "utf8"), sandbox);

const bank = sandbox.window.WORD_SNAP_GRADE8_QUIZ_SENTENCES || [];
assert.strictEqual(bank.length, 239, "grade 8 quiz bank should include exactly the prepared 239 questions");

const sources = new Set(bank.map((q) => q.source));
assert(sources.has("8B Unit5 词汇运用"), "Unit5 source should be included");
assert(sources.has("8B Unit6 词汇应用练习"), "Unit6 source should be included");
assert(sources.has("八下英语期中复习100题"), "midterm 100-question source should be included");

assert(bank.some((q) => q.type === "passage-blank"), "passage blanks should be split into individual questions");
assert(bank.some((q) => q.type === "multiple-choice"), "existing multiple choice questions should be included");

for (const q of bank) {
  assert.strictEqual(q.grade, "初二", `${q.id} should target 初二`);
  assert(q.id && q.sentence && q.answer, `${q.id || "unknown"} should include id, sentence, and answer`);
  assert(Array.isArray(q.options), `${q.id} should include options`);
  assert.strictEqual(q.options.length, 5, `${q.id} should have exactly 5 options`);
  assert.strictEqual(new Set(q.options.map((x) => String(x).toLowerCase())).size, 5, `${q.id} options should be unique`);
  assert.strictEqual(q.options.filter((x) => String(x).toLowerCase() === String(q.answer).toLowerCase()).length, 1, `${q.id} should include the correct answer exactly once`);
}

console.log("grade 8 quiz bank checks passed");
