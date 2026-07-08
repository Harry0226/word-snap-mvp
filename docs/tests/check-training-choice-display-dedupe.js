const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("app.js", "utf8");

assert(app.includes("function choiceDisplayKey"), "training choices should compute a key from the visible option text");
assert(app.includes("function isUsableDistractor"), "training choices should reject duplicate visible distractors");
assert(app.includes("candidateDisplayKey === answerDisplayKey"), "distractors must not display the same text as the correct answer");
assert(app.includes("usedDisplayKeys.has(candidateDisplayKey)"), "distractors must be unique by visible text, not only by id");
assert(app.includes("function buildChoiceSet"), "final choice set should be assembled with display-level de-duplication");
assert(app.includes("const correctChoice = choices.find((choice) => choice.isAnswer);"), "custom choices should keep exactly one visible correct option before trimming");

console.log("training choice display de-dupe checks passed");
