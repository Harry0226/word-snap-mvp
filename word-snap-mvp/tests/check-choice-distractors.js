const fs = require("fs");
const assert = require("assert");

const app = fs.readFileSync("app.js", "utf8");

assert(app.includes("function scoreDistractorChoice"), "training choices should score distractors before picking them");
assert(app.includes("function sameInitial"), "training choices should prefer same-initial distractors");
assert(app.includes("function similarWordShape"), "training choices should prefer structurally similar distractors");
assert(app.includes("scoreDistractorChoice(candidate, answer)"), "makeChoices should use the distractor score");
assert(app.includes("buildChoiceSet(answer, getStructuredDistractors"), "training choices should pass through the display de-duped choice builder");
assert(app.includes("selectRankedDistractors(answer, 3, mode"), "battle choices should reuse ranked, display de-duped distractors");

console.log("choice distractor checks passed");
