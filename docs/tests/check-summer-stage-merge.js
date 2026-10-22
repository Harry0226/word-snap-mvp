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
  "初一课本单元词汇": ["初一课内词汇"],
  "初二课本单元词汇": ["初二课内词汇"],
  "初三课本单元词汇": ["初三课内词汇"],
  "高一课本单元词汇": ["高一课内词汇"],
  "高二课本单元词汇": ["高二课内词汇"]
};
const legacyStageNames = {
  "初一课本单元词汇": "初一暑期必背词汇",
  "初二课本单元词汇": "初二暑期必背词汇",
  "初三课本单元词汇": "初三暑期必背词汇",
  "高一课本单元词汇": "高一暑期必背词汇",
  "高二课本单元词汇": "高二暑期必背词汇"
};
const canonicalStages = [...Object.keys(plans).slice(0, 3), "初中688高频词", ...Object.keys(plans).slice(3)];
const appStagesExpected = [
  ...canonicalStages.slice(0, 5),
  "高一课改词库",
  ...canonicalStages.slice(5),
  "高中3500刷词专栏"
];

function normalizeEnglish(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

for (const [target, sources] of Object.entries(plans)) {
  const list = context.window.WORD_SNAP_STAGE_LISTS[target];
  assert(list, `${target} should have a generated stage asset`);
  assert.strictEqual(list.idGrade, legacyStageNames[target], `${target} should preserve compatible learning-record IDs`);
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
assert.strictEqual(manifest.stages["高一课改词库"].count, 298, "the standalone grade 10 curriculum-reform stage should remain unchanged");
assert.strictEqual(manifest.stages["高中3500刷词专栏"].count, 3515, "the high-school 3500 stage should remain unchanged");
assert(!manifest.stages["高三暑假必背词汇"], "the grade 12 summer stage should be removed");
for (const stage of Object.keys(plans)) {
  assert.strictEqual(plans[stage].length, 1, `${stage} should contain only its original in-class source`);
  assert.match(plans[stage][0], /课内词汇$/, `${stage} should not include exam or supplemental vocabulary`);
}
const appStages = JSON.parse(app.match(/^const STAGES = (\[[^\n]+\]);/m)?.[1] || "[]");
assert.deepStrictEqual(appStages, appStagesExpected, "app should expose merged summer stages and standalone study columns");
assert(app.includes("RENAMED_STAGE_LEGACY_NAMES"), "renamed stages should retain progress for surviving in-class words");

for (const selectId of ["stageSelect", "battleStage", "uploadStage"]) {
  const select = index.match(new RegExp(`<select id="${selectId}">[\\s\\S]*?<\\/select>`))?.[0] || "";
  appStagesExpected.forEach((stage) => assert(select.includes(`value="${stage}"`), `${selectId} should expose ${stage}`));
  assert.strictEqual((select.match(/<option /g) || []).length, appStagesExpected.length, `${selectId} should expose the complete stage registry`);
  assert(!select.includes("暑期必背词汇") && !select.includes("暑假必背词汇"), `${selectId} should not expose legacy summer stages`);
}

console.log("curriculum-only stage checks passed");
