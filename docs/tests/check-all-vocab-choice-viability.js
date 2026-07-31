const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { normalizeDisplayedChoiceText, hasMeaningConflict } = require("../choice-distractors.js");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../word-data/builtin-manifest.js"), "utf8"), context);
const stageDir = path.join(__dirname, "../word-data/stages");
Object.values(context.window.WORD_SNAP_BUILTIN_MANIFEST.stages)
  .map((entry) => entry.src.match(/stages\/([^?]+)/)[1])
  .forEach((name) => vm.runInContext(fs.readFileSync(path.join(stageDir, name), "utf8"), context, { filename: name }));

let checked = 0;
Object.values(context.window.WORD_SNAP_STAGE_LISTS || {}).forEach((list) => {
  const pool = list.words.map((word, index) => ({ ...word, id: `${list.grade}-${index}` }));
  pool.forEach((answer) => {
    ["enToZhChoice", "zhToEnChoice"].forEach((mode) => {
      const displayKey = (word) => normalizeDisplayedChoiceText(mode === "zhToEnChoice" ? word.en : word.zh);
      const usedDisplayKeys = new Set([displayKey(answer)]);
      const selected = [answer];
      pool.forEach((candidate) => {
        if (selected.length >= 4 || candidate.id === answer.id || usedDisplayKeys.has(displayKey(candidate))) return;
        if (selected.some((choice) => hasMeaningConflict(candidate, choice))) return;
        selected.push(candidate);
        usedDisplayKeys.add(displayKey(candidate));
      });
      assert.strictEqual(selected.length, 4, `${list.grade} / ${answer.en} / ${mode} should have four distinct viable choices`);
      checked += 1;
    });
  });
});

assert(checked > 11800, "the full built-in vocabulary should be covered");
console.log(`all-vocabulary choice viability checks passed (${checked} questions)`);
