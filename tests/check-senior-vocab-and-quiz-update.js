const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const builtinSource = fs.readFileSync("word-data/builtin-word-lists.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(builtinSource, sandbox);
vm.runInContext(fs.readFileSync("word-data/quiz-grade10-sentences.js", "utf8"), sandbox);
vm.runInContext(fs.readFileSync("word-data/quiz-grade11-sentences.js", "utf8"), sandbox);

const lists = sandbox.window.WORD_SNAP_BUILTIN_LISTS || [];
const seniorOne = lists.find((list) => list.grade === "高一");
const seniorTwo = lists.find((list) => list.grade === "高二");

assert(seniorOne, "高一 builtin list should exist");
assert(seniorTwo, "高二 builtin list should exist");
assert.strictEqual(seniorOne.words.length, 2140, "高一 should merge and dedupe the final-term vocabulary");
assert.strictEqual(seniorTwo.words.length, 1019, "高二 should merge and dedupe the final-term vocabulary");
assert(seniorOne.words.some((word) => word.en === "available"), "高一 should include the new final-term vocabulary");
assert(seniorOne.words.some((word) => word.en === "adventurous"), "高一 should keep existing unique vocabulary");
assert(seniorTwo.words.some((word) => word.en === "produce"), "高二 should include the new final-term vocabulary");
assert(seniorTwo.words.some((word) => word.en === "Southeast"), "高二 should keep existing unique vocabulary");
assert.strictEqual(new Set(seniorOne.words.map((word) => word.en.toLowerCase())).size, seniorOne.words.length, "高一 words should be deduped by English text");
assert.strictEqual(new Set(seniorTwo.words.map((word) => word.en.toLowerCase())).size, seniorTwo.words.length, "高二 words should be deduped by English text");

const grade10Quiz = sandbox.window.WORD_SNAP_GRADE10_QUIZ_SENTENCES || [];
const grade11Quiz = sandbox.window.WORD_SNAP_GRADE11_QUIZ_SENTENCES || [];
assert.strictEqual(grade10Quiz.length, 153, "高一 quiz should include every numbered Word item");
assert.strictEqual(grade11Quiz.length, 129, "高二 quiz should include every numbered Word item");

for (const question of [...grade10Quiz, ...grade11Quiz]) {
  assert(question.id && question.grade && question.sentence && question.answer, "quiz question should contain required fields");
  assert.strictEqual(question.options.length, 5, `${question.id} should have exactly 5 options`);
  assert.strictEqual(question.options.filter((option) => option === question.answer).length, 1, `${question.id} should include the correct answer exactly once`);
  assert(question.sentence.includes("______"), `${question.id} should render as a blank question`);
}

assert(!index.includes('src="./word-data/quiz-grade10-sentences.js?v='), "index should not block first paint with 高一 quiz data");
assert(!index.includes('src="./word-data/quiz-grade11-sentences.js?v='), "index should not block first paint with 高二 quiz data");
assert(app.includes('"高一": "./word-data/quiz-grade10-sentences.js?v='), "app should lazily load 高一 quiz data with a versioned URL");
assert(app.includes('"高二": "./word-data/quiz-grade11-sentences.js?v='), "app should lazily load 高二 quiz data with a versioned URL");
assert(app.includes('if (grade === "高一") return window.WORD_SNAP_GRADE10_QUIZ_SENTENCES || [];'), "高一 quiz should read the dedicated quiz bank");
assert(app.includes('if (grade === "高二") return window.WORD_SNAP_GRADE11_QUIZ_SENTENCES || [];'), "高二 quiz should read the dedicated quiz bank");
assert(app.includes("GRADE10_QUIZ_COUNT = 153"), "高一 quiz should have a load guard");
assert(app.includes("GRADE11_QUIZ_COUNT = 129"), "高二 quiz should have a load guard");
assert(app.includes("BUILTIN_SEED_VERSION = 15"), "builtin seed version should be bumped for 高一/高二 replacement");

console.log("senior vocab and quiz update checks passed");
