const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const juniorSource = fs.readFileSync("word-data/junior-exam-words.js", "utf8");
const builtinSource = fs.readFileSync("word-data/builtin-word-lists.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(juniorSource, sandbox);

const words = sandbox.window.WORD_SNAP_WORDS || [];
const meta = sandbox.window.WORD_SNAP_WORDS_META || {};
const unique = new Set(words.map((word) => word.en));

assert(words.length >= 790, "new junior word list should contain the full provided deck");
assert.strictEqual(unique.size, words.length, "new junior word list should not contain duplicate English entries");
assert(words.some((word) => word.en === "able" && word.zh.includes("能够")), "new junior list should include the provided first entry");
assert(words.some((word) => word.en === "young" && word.zh.includes("年轻")), "new junior list should include the provided last entry");
assert.strictEqual(meta.source, "初三核心词库", "new junior source name should be stable");
assert.strictEqual(JSON.stringify(meta.goals), JSON.stringify(["初三", "中考冲刺"]), "new junior list should cover both 初三 and 中考冲刺");
assert(!juniorSource.includes("近五年中考结合最新一模"), "old exam source name should be removed from junior word data");
assert(!juniorSource.includes("初三刷题词库"), "old junior source name should be removed from junior word data");
assert(app.includes("BUILTIN_SEED_VERSION = 5"), "builtin seed version should be bumped for existing browsers");
assert(app.includes('"初三核心词库"'), "app should seed the new junior source name");
assert(app.includes("deleteRecordsForMissingWords"), "old builtin records should be removed after reseeding");
assert(!builtinSource.includes('"source":  "初三刷题词库"'), "old junior builtin deck should not remain in builtin lists");

console.log("junior word list checks passed");
