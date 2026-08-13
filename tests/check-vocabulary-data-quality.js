const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");
const { dedupeVocabularyEntries } = require("../choice-distractors.js");

const root = path.resolve(__dirname, "..");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "word-data", "builtin-manifest.js"), "utf8"), context);

for (const entry of Object.values(context.window.WORD_SNAP_BUILTIN_MANIFEST.stages)) {
  const filename = entry.src.match(/stages\/([^?]+)/)[1];
  vm.runInContext(fs.readFileSync(path.join(root, "word-data", "stages", filename), "utf8"), context, { filename });
}

const knownBrokenSpellings = new Set([
  "cant", "disciplin", "dres", "hes", "includ", "jok", "kindnes", "lets",
  "mans", "shes", "sometim", "trouser", "whats", "wont"
]);

let checked = 0;
for (const [grade, entry] of Object.entries(context.window.WORD_SNAP_BUILTIN_MANIFEST.stages)) {
  const words = context.window.WORD_SNAP_STAGE_LISTS[grade].words;
  const uniqueWords = dedupeVocabularyEntries(words);
  assert.strictEqual(
    uniqueWords.length,
    entry.uniqueCount || entry.count,
    `${grade} should expose the audited number of unique vocabulary rows`
  );

  for (const word of uniqueWords) {
    const spelling = String(word.en || "").trim().toLowerCase();
    assert(spelling && word.zh, `${grade} must not contain blank vocabulary rows`);
    assert(!knownBrokenSpellings.has(spelling), `${grade} still contains the known broken spelling: ${word.en}`);
    assert(!/\s{2,}/.test(word.en), `${grade} contains accidental repeated spaces: ${word.en}`);
    assert(!/[A-Za-z]{2,}/.test(word.zh), `${grade} Chinese definition contains merged English/source text: ${word.en} = ${word.zh}`);
    checked += 1;
  }
}

const grade10InClass = context.window.WORD_SNAP_STAGE_LISTS["高一课本单元词汇"].words;
for (const [en, zh] of [["proposal", "提议,建议,动议"], ["sight", "视野,视力,看见"], ["seek", "试图,寻找,争取,寻求"], ["pressure", "心理压力,紧张,压力,要求,催促"]]) {
  assert(grade10InClass.some((word) => word.en === en && word.zh.includes(zh)), `${en} should be restored as a standalone vocabulary row`);
}

const grade9Source = fs.readFileSync(path.join(root, "word-data", "stages", "初三考试词汇.txt"), "utf8");
for (const spelling of ["disciplin", "dres", "includ", "jok", "kindnes", "sometim", "trouser"]) {
  assert(!new RegExp(`^${spelling}\\s`, "m").test(grade9Source), `source vocabulary must not reintroduce ${spelling}`);
}

assert(checked > 5900, "all unique built-in vocabulary rows should be audited");
console.log(`vocabulary data quality checks passed (${checked} unique rows)`);
