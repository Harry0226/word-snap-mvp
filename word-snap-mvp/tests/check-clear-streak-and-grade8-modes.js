const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("app.js", "utf8");

assert(app.includes("async function resetStreak(kind, grade)"), "app should reset a selected grade streak");
assert(app.includes('await resetStreak("train", els.stageSelect.value)'), "clearing training records should reset the selected training streak");
assert(app.includes('await resetStreak("quiz", els.quizStage.value)'), "clearing quiz wrong answers should reset the selected quiz streak");
assert(app.includes('tx("streaks", "readwrite").delete(key)'), "streak reset should remove persisted streak data");

const resolveMode = app.slice(app.indexOf("function resolvePracticeMode"), app.indexOf("async function startSession"));
assert(
  resolveMode.includes('word?.fixedMode === "customChoice"'),
  "custom writing questions should retain their dedicated fixed mode"
);
assert(!resolveMode.includes("return word.fixedMode"), "ordinary vocabulary fixedMode must not override the selected mode");

const makeChoices = app.slice(app.indexOf("function makeChoices"), app.indexOf("function choiceText"));
assert(makeChoices.includes('state.session?.mode === "customChoice"'), "preset choiceOptions should only be used for custom questions");
assert(makeChoices.includes('answer.grade === "高二"'), "高二 should use structured vocabulary-bank distractors");

const correctness = app.slice(app.indexOf("function isCorrectAnswer"), app.indexOf("function feedbackText"));
assert(correctness.includes('mode === "customChoice"'), "only custom questions should use preset answer flags");
assert(!correctness.includes("Array.isArray(word.choiceOptions)"), "ordinary vocabulary should be checked by word id");

console.log("clear streak and grade 8 mode checks passed");
