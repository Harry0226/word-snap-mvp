const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const sessionSelect = index.match(/<select id="sessionSize">[\s\S]*?<\/select>/)?.[0] || "";

assert(!sessionSelect.includes('value="100"'), "training size should no longer offer 100 words");
assert(!sessionSelect.includes('value="20"'), "training size should not offer 20 words");
assert(!sessionSelect.includes('value="50"'), "training size should not offer 50 words");
assert(sessionSelect.includes('value="200" selected>200 词'), "training size should default to 200 words");
assert(sessionSelect.includes('value="all">全部单词'), "training size should still offer all words");

assert(app.includes("const SLOW_PICK_LIMIT = 12000;"), "slow word threshold should be 12 seconds");
assert(app.includes("const isSlow = isCorrect && elapsed > SLOW_PICK_LIMIT;"), "slow words should use the 4 second threshold");
assert(!app.includes("mastery < 60"), "weak words should not be triggered by low mastery alone");
assert(app.includes("record.slow += isSlow ? 1 : 0;"), "records should store slow picks based on isSlow");
assert(/if \(isSlow\) session\.slowWords\.push\(word\);/.test(app), "session slow list should use isSlow");

console.log("session size and weak rule checks passed");
