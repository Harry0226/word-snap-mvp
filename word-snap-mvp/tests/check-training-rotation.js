const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const sessionSelect = index.match(/<select id="sessionSize">[\s\S]*?<\/select>/)?.[0] || "";

assert(!sessionSelect.includes('value="20">20 词'), "training size should no longer offer 20 words");
assert(!sessionSelect.includes('value="50"'), "training size should no longer offer 50 words");
assert(!sessionSelect.includes('value="100"'), "training size should no longer offer 100 words");
assert(sessionSelect.includes('value="200" selected>200 词'), "training size should default to 200 words");
assert(sessionSelect.includes('value="all">全部单词'), "training size should still offer all words");

assert(app.includes("function updateSessionSizeOptions"), "training size options should update when stage changes");
assert(app.includes('els.stageSelect.value === "初三"'), "400/600 training sizes should be scoped to 初三");
assert(app.includes('["400", "400 词"]'), "初三 training size should offer 400 words");
assert(app.includes('["600", "600 词"]'), "初三 training size should offer 600 words");
assert(app.includes('options.some(([value]) => value === previous) ? previous : "200"'), "training size should keep valid previous values and default to 200");

assert(app.includes("queueCursor"), "session state should track a queue cursor snapshot");
assert(app.includes("buildRotationKey"), "training queues should use a scoped rotation key");
assert(app.includes("stableShuffleWords"), "training queues should use stable shuffled order");
assert(app.includes("peekRotatingQueue"), "estimate rendering should not advance rotation");
assert(app.includes("commitQueueCursor"), "rotation should only advance when a session completes");
assert(app.includes('put("meta", { key: queueCursor.key'), "rotation cursor should be saved to IndexedDB meta");
assert(app.includes("formatDuration"), "session report should format total training time");
assert(app.includes("totalSeconds"), "session report should include total training seconds");

console.log("training rotation checks passed");
