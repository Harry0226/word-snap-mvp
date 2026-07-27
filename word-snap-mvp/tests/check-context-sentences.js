const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("word-data/builtin-manifest.js", "utf8"), context);

const manifest = context.window.WORD_SNAP_BUILTIN_MANIFEST;
for (const entry of Object.values(manifest.stages)) {
  vm.runInContext(fs.readFileSync(entry.src.replace("./word-data/", "word-data/"), "utf8"), context);
}

const stageLists = context.window.WORD_SNAP_STAGE_LISTS;
const rows = Object.entries(manifest.stages).flatMap(([stage, entry]) => {
  const list = stageLists[stage];
  assert.ok(list, `${stage} context data should load`);
  assert.strictEqual(list.words.length, entry.count, `${stage} word count should stay unchanged`);
  return list.words.map((word) => ({ ...word, grade: stage }));
});

assert.strictEqual(rows.length, 12137, "all active built-in rows should be checked");

const unsafe = /\b(?:rape|porn|naked|nude|sexy|cocaine|heroin|meth|whore|prostitute|slut|fuck|fucking|shit|condom|penis|vagina)\b/i;
const meta = /\b(?:used to mean|means? the same as|here,\s*[“"'])/i;
const sentenceTerms = new Map();
let juniorWords = 0;
let juniorRows = 0;

for (const word of rows) {
  const sentence = String(word.contextSentence || "").trim();
  const words = sentence.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*|\d+/g) || [];
  assert.ok(sentence, `${word.grade}/${word.en} should have a built-in context`);
  assert.ok(words.length >= 4 && words.length <= 18, `${word.en} context should be short: ${sentence}`);
  assert.ok(sentence.length <= 120, `${word.en} context should fit the card`);
  assert.ok(/^[A-Z“"']/.test(sentence), `${word.en} context should start like a sentence`);
  assert.ok(/[.!?][”"']?$/.test(sentence), `${word.en} context should end with punctuation`);
  assert.ok(!unsafe.test(sentence), `${word.en} context should be student-safe`);
  assert.ok(!meta.test(sentence), `${word.en} context should show usage instead of defining the word`);
  assert.ok(!sentence.includes("..."), `${word.en} context should not contain broken fragments`);
  assert.ok(!/All Rights Reserved/i.test(sentence), `${word.en} context should not contain source noise`);

  const term = String(word.en || "").toLowerCase().replace(/\s+all rights reserved.*$/i, "").trim();
  if (!sentenceTerms.has(sentence)) sentenceTerms.set(sentence, new Set());
  sentenceTerms.get(sentence).add(term);
  if (word.grade.includes("初")) {
    juniorRows += 1;
    juniorWords += words.length;
  }
}

for (const [sentence, terms] of sentenceTerms) {
  assert.ok(terms.size <= 3, `one context should not be recycled across unrelated words: ${sentence}`);
}

assert.ok(juniorWords / juniorRows <= 10.5, "junior contexts should stay concise");

const highSchool = stageLists["高中3500刷词专栏"].words;
const brand = highSchool.find((word) => word.en === "brand");
assert.ok(brand.contextSentence.includes("brand"), "brand context should use the target word naturally");
assert.ok(!/used to mean/i.test(brand.contextSentence), "brand should not use the old definition template");

const feedNoun = stageLists["初三暑期必背词汇"].words.find(
  (word) => word.en === "feed" && word.zh === "饲料"
);
assert.match(feedNoun.contextSentence, /farmer|chickens|feed/i, "feed noun context should match 饲料");

const license = fs.readFileSync("word-data/CONTEXT_SENTENCES_LICENSE.md", "utf8");
assert.match(license, /Tatoeba/i, "context corpus attribution should ship with the site");

console.log(`context sentence checks passed (${rows.length} rows, ${sentenceTerms.size} unique sentences)`);
