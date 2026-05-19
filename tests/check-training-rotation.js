const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const sessionSelect = index.match(/<select id="sessionSize">[\s\S]*?<\/select>/)?.[0] || "";

assert(!sessionSelect.includes('value="20">20 词'), "training size should no longer offer 20 words");
assert(!sessionSelect.includes('value="50"'), "training size should no longer offer 50 words");
assert(sessionSelect.includes('value="100" selected>100 词'), "training size should default to 100 words");
assert(sessionSelect.includes('value="200">200 词'), "training size should offer 200 words");
assert(sessionSelect.includes('value="all">全部单词'), "training size should still offer all words");

assert(app.includes("queueCursor"), "session state should track a queue cursor snapshot");
assert(app.includes("buildRotationKey"), "training queues should use a scoped rotation key");
assert(app.includes("stableShuffleWords"), "training queues should use stable shuffled order");
assert(app.includes("peekRotatingQueue"), "estimate rendering should not advance rotation");
assert(app.includes("commitQueueCursor"), "rotation should only advance when a session completes");
assert(app.includes('put("meta", { key: queueCursor.key'), "rotation cursor should be saved to IndexedDB meta");
assert(app.includes("formatDuration"), "session report should format total training time");
assert(app.includes("totalSeconds"), "session report should include total training seconds");

console.log("training rotation checks passed");
