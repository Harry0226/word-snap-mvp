const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const juniorSource = fs.readFileSync("word-data/junior-exam-words.js", "utf8");
const juniorJson = JSON.parse(fs.readFileSync("word-data/junior-exam-words.json", "utf8"));
assert(fs.existsSync("word-data/phrase-review-words.js"), "phrase review word data file should exist");
const phraseSource = fs.readFileSync("word-data/phrase-review-words.js", "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(juniorSource, sandbox);
vm.runInContext(phraseSource, sandbox);

const juniorMeta = juniorJson.meta || {};
const phraseWords = sandbox.window.WORD_SNAP_PHRASE_REVIEW_WORDS || [];
const phraseMeta = sandbox.window.WORD_SNAP_PHRASE_REVIEW_META || {};
const allText = `${index}\n${app}\n${juniorSource}\n${phraseSource}`;

assert(!allText.includes("中考冲刺"), "old stage name should be removed everywhere");
assert(index.includes("中考常考词组总复习"), "page should expose the phrase review stage");
assert(app.includes('"中考常考词组总复习"'), "app stage list should include phrase review");
assert.strictEqual(JSON.stringify(juniorMeta.goals), JSON.stringify(["初三"]), "junior deck should no longer feed phrase review");
assert.strictEqual(phraseMeta.source, "中考常考词组总复习", "phrase deck source should be stable");
assert.strictEqual(JSON.stringify(phraseMeta.goals), JSON.stringify(["中考常考词组总复习"]), "phrase deck should only target phrase review");
assert.strictEqual(phraseWords.length, 189, "phrase review deck should contain 189 cleaned phrases");
assert(phraseWords.some((word) => word.en === "pay attention to (doing) sth."), "phrase deck should include the first phrase");
assert(phraseWords.some((word) => word.en === "would rather do sth. than do sth."), "phrase deck should split the first expression in item 3");
assert(phraseWords.some((word) => word.en === "prefer (doing) sth. to (doing) sth."), "phrase deck should split the second expression in item 3");
assert(phraseWords.some((word) => word.en === "remind sb. of sth."), "phrase deck should include the final phrase");
assert(app.includes("BUILTIN_SEED_VERSION = 15"), "builtin seed version should be bumped for existing browsers");

console.log("phrase review stage checks passed");
