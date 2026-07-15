const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("app.js", "utf8");

assert(app.includes("function scoreDistractorChoice"), "training choices should score distractors before picking them");
assert(app.includes("function sameInitial"), "training choices should prefer same-initial distractors");
assert(app.includes("function similarWordShape"), "training choices should prefer structurally similar distractors");
assert(app.includes("scoreDistractorChoice(candidate, answer, mode)"), "makeChoices should score distractors for the visible training mode");
assert(app.includes("buildChoiceSet(answer, getStructuredDistractors"), "training choices should pass through the display de-duped choice builder");
assert(app.includes("selectRankedDistractors(answer, 3, mode"), "battle choices should reuse ranked, display de-duped distractors");
assert(/function getTrainingChoiceCount\(answer\) \{\s+return 4;\s+\}/.test(app), "every vocabulary training question should use four choices");
assert(app.includes("bestScore - 3"), "distractors should stay close to the strongest difficulty score");

console.log("choice distractor checks passed");
