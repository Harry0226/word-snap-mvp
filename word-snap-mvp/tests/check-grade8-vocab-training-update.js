const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const builtinSource = fs.readFileSync("word-data/builtin-word-lists.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const sandbox = { window: {} };

vm.createContext(sandbox);
vm.runInContext(builtinSource, sandbox);

const grade8 = sandbox.window.WORD_SNAP_BUILTIN_LISTS.find((list) => list.grade === "\u521d\u4e8c");
const grade7 = sandbox.window.WORD_SNAP_BUILTIN_LISTS.find((list) => list.grade === "\u521d\u4e00");
const grade8Words = grade8.words || [];
const grade8English = new Set(grade8Words.map((word) => word.en));

assert(grade8Words.length > 396, "\u521d\u4e8c word bank should include the 6.2 update on top of the existing 396 words");
assert(grade8English.has("passage"), "\u521d\u4e8c update should include passage");
assert(grade8English.has("pay attention to"), "\u521d\u4e8c update should include pay attention to");
assert(grade8English.has("meet the needs"), "\u521d\u4e8c update should include meet the needs");
assert(grade8English.has("continent"), "\u521d\u4e8c update should include continent");
assert(grade8English.has("body language"), "\u521d\u4e8c update should include body language");
assert.strictEqual(grade8English.size, grade8Words.length, "\u521d\u4e8c word bank should not duplicate English entries");
assert(grade7.words.length > 0, "other grade word banks should still load");

assert(app.includes("BUILTIN_SEED_VERSION = 14"), "seed version should bump so existing browsers receive the updated \u521d\u4e8c bank");
assert(app.includes('{ grade: "\u521d\u4e8c", source: "\u521d\u4e8c\u5185\u7f6e\u8bcd\u5e93" }'), "old \u521d\u4e8c builtin deck should be removed before reseeding");
assert(app.includes("function getTrainingChoiceCount"), "training choice count should be grade-aware");
assert(app.includes('return answer.grade === "\u521d\u4e8c" ? 5 : 4'), "\u521d\u4e8c training should use 5 choices while other grades stay at 4");
assert(app.includes("function getGradeWordPool"), "\u521d\u4e8c distractors should be selected from the full grade word pool");
assert(app.includes("function getStructuredDistractors"), "training distractors should prefer same-first and similar-structure words");
assert(app.includes("sameFirstLimit"), "same-first distractors should be capped so not every option uses the same first letter");

console.log("grade8 vocab and training update checks passed");
