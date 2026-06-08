const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const juniorSource = fs.readFileSync("word-data/junior-exam-words.js", "utf8");
const juniorJson = JSON.parse(fs.readFileSync("word-data/junior-exam-words.json", "utf8"));
const builtinSource = fs.readFileSync("word-data/builtin-word-lists.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(juniorSource, sandbox);

const words = sandbox.window.WORD_SNAP_WORDS || [];
const meta = juniorJson.meta || {};
const unique = new Set(words.map((word) => word.en));

assert.strictEqual(words.length, 775, "new junior word list should contain 775 unique words");
assert.strictEqual(juniorJson.words.length, 775, "junior JSON should contain 775 unique words");
assert.strictEqual(unique.size, words.length, "new junior word list should not contain duplicate English entries");
assert(words.some((word) => word.en === "traffic" && word.zh.includes("交通")), "new junior list should include the updated first entry");
assert(words.some((word) => word.en === "wish" && word.zh.includes("愿望")), "new junior list should include the updated last entry");
assert.strictEqual(meta.source, "苏州中考英语词汇精选", "new junior source name should match the 834-word exam deck");
assert.strictEqual(JSON.stringify(meta.goals), JSON.stringify(["初三"]), "new junior list should only cover 初三");
assert(!juniorSource.includes("中考冲刺"), "old exam sprint stage should be removed from junior word data");
assert(!juniorSource.includes("近五年中考结合最新一模"), "old exam source name should be removed from junior word data");
assert(!juniorSource.includes("初三刷题词库"), "old junior source name should be removed from junior word data");
assert(app.includes("BUILTIN_SEED_VERSION = 15"), "builtin seed version should be bumped for existing browsers");
assert(app.includes('"初三核心词库"'), "app should seed the new junior source name");
assert(app.includes("deleteRecordsForMissingWords"), "old builtin records should be removed after reseeding");
assert(!builtinSource.includes('"source":  "初三刷题词库"'), "old junior builtin deck should not remain in builtin lists");

console.log("junior word list checks passed");
