const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const app = fs.readFileSync("app.js", "utf8");
const start = app.indexOf("function buildExactTrainingQueue");
const end = app.indexOf("function updateTrainingEstimate");
const source = app.slice(start, end);
const historicalWrong = { id: "historical", en: "old", zh: "旧错词" };
const currentWrongA = { id: "current-a", en: "current", zh: "本轮错词一" };
const currentWrongB = { id: "current-b", en: "latest", zh: "本轮错词二" };
const context = {
  state: { words: [historicalWrong, currentWrongA, currentWrongB], queueNotice: "" },
  shuffle: (items) => [...items]
};

vm.runInNewContext(source, context);
const result = context.buildExactTrainingQueue(["current-a", "current-b", "current-a", "missing"], "仅练本轮新增错词。");

assert.deepStrictEqual(Array.from(result.queue, (word) => word.id), ["current-a", "current-b"], "retry should contain only unique ids from the latest session");
assert(!result.queue.some((word) => word.id === "historical"), "historical wrong words must not leak into retry");
assert.strictEqual(result.rotationKey, null, "session-only retry must not consume the persistent rotation queue");
assert.strictEqual(context.state.queueNotice, "仅练本轮新增错词。");

console.log("session retry queue checks passed");
