const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const app = fs.readFileSync("app.js", "utf8");
const resolveModeSource = app.slice(
  app.indexOf("function resolvePracticeMode"),
  app.indexOf("function practiceModeLabel")
);
const context = {
  state: { session: null },
  els: { practiceMode: { value: "zhToEnChoice" } },
  Math
};
vm.runInNewContext(resolveModeSource, context);

const sevenDayWord = { id: "seven-day", sourceType: "builtin" };
assert.strictEqual(
  context.resolvePracticeMode(sevenDayWord, "enToZhChoice"),
  "enToZhChoice",
  "seven-day words should respect see-English/select-Chinese mode"
);
assert.strictEqual(
  context.resolvePracticeMode(sevenDayWord, "audioToZhChoice"),
  "audioToZhChoice",
  "seven-day words should respect listen/select-Chinese mode"
);
assert.strictEqual(
  context.resolvePracticeMode(sevenDayWord, "zhToEnChoice"),
  "zhToEnChoice",
  "seven-day words should respect see-Chinese/select-English mode"
);

const nextWordSource = app.slice(app.indexOf("function nextWord"), app.indexOf("function hintForMode"));
assert(
  nextWordSource.includes("resolvePracticeMode(session.current, session.practiceMode)"),
  "questions should use the mode captured when the session started"
);
assert(
  !nextWordSource.includes('isSevenDayCheck\n    ? "zhToEnChoice"'),
  "seven-day checks must not force see-Chinese/select-English mode"
);

console.log("practice mode selection checks passed");
