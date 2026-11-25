const assert = require("assert");
const {
  normalizeDisplayedChoiceText,
  dedupeVocabularyEntries,
  isEquivalentVocabularyAnswer,
  splitChineseSenses,
  hasMeaningConflict
} = require("../choice-distractors.js");

const kind = { en: "kind", zh: "种类，善良的" };

assert.deepStrictEqual(splitChineseSenses(kind.zh), ["种类", "善良"], "multi-sense definitions should be compared one meaning at a time");
assert(hasMeaningConflict({ en: "kinds", zh: "种类" }, kind), "a partial duplicate meaning must not become a distractor");
assert(hasMeaningConflict({ en: "kindness", zh: "善良" }, kind), "a second partial duplicate meaning must not become a distractor");
assert(hasMeaningConflict({ en: "kindness", zh: "善良，好意" }, { en: "kind", zh: "友善的" }), "related word-family choices with shared meaning should be rejected");
assert(hasMeaningConflict({ en: "match", zh: "比赛" }, { en: "match", zh: "般配，相配" }), "different meanings of match must not become mutually exclusive answers");
assert(hasMeaningConflict({ en: "smart", zh: "衣冠楚楚的，衣着讲究的" }, { en: "smart", zh: "聪明的，智能的" }), "different meanings of smart must not become mutually exclusive answers");
assert(isEquivalentVocabularyAnswer({ id: "match-1", en: "match", zh: "比赛" }, { id: "match-2", en: "match", zh: "般配，相配" }), "another valid sense of the same prompt must be accepted as correct");
assert(!isEquivalentVocabularyAnswer({ id: "match-1", en: "match", zh: "比赛" }, { id: "smart-1", en: "smart", zh: "聪明的" }), "a different English word must remain incorrect");
assert(!hasMeaningConflict({ en: "king", zh: "国王" }, kind), "a similar-looking but semantically distinct word should remain a useful distractor");
assert.strictEqual(normalizeDisplayedChoiceText(" Kind "), "kind", "visible English choices should de-duplicate without case differences");
assert.deepStrictEqual(
  dedupeVocabularyEntries([{ en: "kind", zh: "善良的" }, { en: " Kind ", zh: "善良的" }, { en: "kind", zh: "种类" }]),
  [{ en: "kind", zh: "善良的" }, { en: "kind", zh: "种类" }],
  "only fully duplicated vocabulary rows should be removed"
);

console.log("choice semantic conflict checks passed");
