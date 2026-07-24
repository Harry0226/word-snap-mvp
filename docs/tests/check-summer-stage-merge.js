const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const stageDir = path.join(root, "word-data", "stages");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const context = { window: {} };
vm.createContext(context);

const sourceFiles = [
  "grade7-inclass.js", "grade7-exam.js",
  "grade8-inclass.js", "grade8-exam.js",
  "grade9-inclass.js", "grade9-exam.js",
  "grade10-inclass.js", "grade10-exam.js", "grade10-curriculum.js",
  "grade11-inclass.js", "grade11-exam.js",
  "grade12-inclass.js",
  "junior-high-frequency-688.js"
];
sourceFiles.forEach((filename) => {
  vm.runInContext(fs.readFileSync(path.join(stageDir, filename), "utf8"), context, { filename });
});

const sourceLists = { ...context.window.WORD_SNAP_STAGE_LISTS };
vm.runInContext(fs.readFileSync(path.join(root, "word-data", "builtin-manifest.js"), "utf8"), context);
const manifest = context.window.WORD_SNAP_BUILTIN_MANIFEST;
Object.values(manifest.stages).forEach((entry) => {
  const filename = entry.src.match(/stages\/([^?]+)/)[1];
  vm.runInContext(fs.readFileSync(path.join(stageDir, filename), "utf8"), context, { filename });
});

const plans = {
  "初一暑期必背词汇": ["初一课内词汇", "初一考试词汇", "初中688高频词"],
  "初二暑期必背词汇": ["初二课内词汇", "初二考试词汇", "初中688高频词"],
  "初三暑期必背词汇": ["初三课内词汇", "初三考试词汇", "初中688高频词"],
  "高一暑期必背词汇": ["高一课内词汇", "高一考试词汇", "高一课改词库"],
  "高二暑期必背词汇": ["高二课内词汇", "高二考试词汇"],
  "高三暑假必背词汇": [
    "高一课内词汇", "高一考试词汇", "高一课改词库",
    "高二课内词汇", "高二考试词汇", "高三考试词汇"
  ]
};
const canonicalStages = [...Object.keys(plans).slice(0, 3), "初中688高频词", ...Object.keys(plans).slice(3)];

function normalizeEnglish(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

for (const [target, sources] of Object.entries(plans)) {
  const list = context.window.WORD_SNAP_STAGE_LISTS[target];
  assert(list, `${target} should have a generated stage asset`);
  assert.deepStrictEqual(Array.from(list.sources), sources, `${target} should record all merged source stages`);

  const expected = new Map();
  sources.flatMap((source) => sourceLists[source].words).forEach((word) => {
    const key = normalizeEnglish(word.en);
    if (!expected.has(key)) expected.set(key, new Set());
    expected.get(key).add(String(word.zh).trim());
  });

  const actualKeys = list.words.map((word) => normalizeEnglish(word.en));
  assert.strictEqual(new Set(actualKeys).size, actualKeys.length, `${target} should contain only one row per English word`);
  assert.strictEqual(actualKeys.length, expected.size, `${target} should retain every unique English word from its sources`);
  assert.strictEqual(list.words.length, manifest.stages[target].count, `${target} should match its manifest count`);

  list.words.forEach((word) => {
    const sourceMeanings = expected.get(normalizeEnglish(word.en));
    assert(sourceMeanings, `${target} unexpectedly introduced ${word.en}`);
    sourceMeanings.forEach((meaning) => {
      assert(word.zh.includes(meaning), `${target} / ${word.en} should retain source meaning: ${meaning}`);
    });
  });
}

assert.strictEqual(manifest.stages["初中688高频词"].count, 688, "the standalone junior 688 stage should remain unchanged");
for (const stage of ["初一暑期必背词汇", "初二暑期必背词汇", "初三暑期必背词汇"]) {
  assert(plans[stage].includes("初中688高频词"), `${stage} should include all junior 688 words`);
}
assert(!plans["高三暑假必背词汇"].includes("初中688高频词"), "high school cumulative vocabulary must not absorb the junior 688 stage");
const appStages = JSON.parse(app.match(/^const STAGES = (\[[^\n]+\]);/m)?.[1] || "[]");
assert.deepStrictEqual(appStages, canonicalStages, "app should expose only the merged summer stages plus junior 688");

for (const selectId of ["stageSelect", "battleStage", "uploadStage"]) {
  const select = index.match(new RegExp(`<select id="${selectId}">[\\s\\S]*?<\\/select>`))?.[0] || "";
  canonicalStages.forEach((stage) => assert(select.includes(`value="${stage}"`), `${selectId} should expose ${stage}`));
  assert.strictEqual((select.match(/<option /g) || []).length, canonicalStages.length, `${selectId} should not retain split legacy stages`);
}

console.log("summer stage merge checks passed");
