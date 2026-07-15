const assert = require("assert");
const {
  normalizeDisplayedChoiceText,
  splitChineseSenses,
  hasMeaningConflict
} = require("../choice-distractors.js");

const kind = { en: "kind", zh: "种类，善良的" };

assert.deepStrictEqual(splitChineseSenses(kind.zh), ["种类", "善良"], "multi-sense definitions should be compared one meaning at a time");
assert(hasMeaningConflict({ en: "kinds", zh: "种类" }, kind), "a partial duplicate meaning must not become a distractor");
assert(hasMeaningConflict({ en: "kindness", zh: "善良" }, kind), "a second partial duplicate meaning must not become a distractor");
assert(hasMeaningConflict({ en: "kindness", zh: "善良，好意" }, { en: "kind", zh: "友善的" }), "related word-family choices with shared meaning should be rejected");
assert(!hasMeaningConflict({ en: "king", zh: "国王" }, kind), "a similar-looking but semantically distinct word should remain a useful distractor");
assert.strictEqual(normalizeDisplayedChoiceText(" Kind "), "kind", "visible English choices should de-duplicate without case differences");

console.log("choice semantic conflict checks passed");
