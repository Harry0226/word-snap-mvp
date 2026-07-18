const fs = require("fs");
const assert = require("assert");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const sessionSelect = index.match(/<select id="sessionSize">[\s\S]*?<\/select>/)?.[0] || "";

assert(!sessionSelect.includes('value="50"'), "training size should no longer offer 50 words");
assert(sessionSelect.includes('value="100"'), "training size should offer 100 words");
assert(sessionSelect.includes('value="200" selected>200 词'), "training size should default to 200 words");
assert(sessionSelect.includes('value="300"'), "training size should offer 300 words");
assert(sessionSelect.includes('value="400"'), "training size should offer 400 words");
assert(sessionSelect.includes('value="all">全部词'), "training size should still offer all words");

assert(app.includes("function updateSessionSizeOptions"), "training size options should update when stage changes");
assert(app.includes('options.some(([value]) => value === previous) ? previous : "200"'), "training size should keep valid previous values and default to 200");

assert(index.includes('src="./rotation-queue.js?v='), "the persistent rotation module should load before app.js");
assert(app.includes("rotationQueues"), "app state should load persistent rotation queues");
assert(app.includes("buildTrainingRotationKey"), "training rotation should be scoped by stage and deck source");
assert(app.includes("prepareRotationBatch"), "training should allocate batches through the shared rotation module");
assert(app.includes("completePersistentRotationItem"), "each answered item should persist rotation progress");
assert(app.includes('put("meta", { key, value: rotationState'), "rotation state should be saved to IndexedDB meta");
assert(!app.includes("queueCursor:"), "the old completion-only cursor should no longer be used");
assert(app.includes("formatDuration"), "session report should format total training time");
assert(app.includes("totalSeconds"), "session report should include total training seconds");

console.log("training rotation checks passed");
