const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const wordDataDir = path.join(root, "word-data");
const outputDir = path.join(wordDataDir, "stages");
const context = { window: {} };
vm.createContext(context);

for (const filename of ["builtin-word-lists.js", "junior-exam-words.js", "phrase-review-words.js"]) {
  vm.runInContext(fs.readFileSync(path.join(wordDataDir, filename), "utf8"), context);
}

const lists = [
  {
    grade: "初三",
    goals: ["初三"],
    source: "初三核心词库",
    words: context.window.WORD_SNAP_WORDS || []
  },
  {
    grade: "中考常考词组总复习",
    goals: ["中考常考词组总复习"],
    source: "中考常考词组总复习",
    words: context.window.WORD_SNAP_PHRASE_REVIEW_WORDS || []
  },
  ...(context.window.WORD_SNAP_BUILTIN_LISTS || [])
];

const slugs = {
  "小学六年级": "grade6",
  "初一": "grade7",
  "初二": "grade8",
  "初三": "grade9",
  "高一": "grade10",
  "高二": "grade11",
  "高三": "grade12",
  "中考常考词组总复习": "junior-phrases"
};
const version = "20260608-lazy-stages";
const manifest = {};

fs.mkdirSync(outputDir, { recursive: true });
for (const list of lists) {
  const slug = slugs[list.grade];
  if (!slug) throw new Error(`Missing stage slug: ${list.grade}`);
  const filename = `${slug}.js`;
  const payload = { ...list, version };
  const script = `window.WORD_SNAP_STAGE_LISTS = window.WORD_SNAP_STAGE_LISTS || {};\nwindow.WORD_SNAP_STAGE_LISTS[${JSON.stringify(list.grade)}] = ${JSON.stringify(payload)};\n`;
  fs.writeFileSync(path.join(outputDir, filename), script);
  manifest[list.grade] = {
    src: `./word-data/stages/${filename}?v=${version}`,
    version,
    count: list.words.length,
    source: list.source
  };
}

const manifestScript = `window.WORD_SNAP_BUILTIN_MANIFEST = ${JSON.stringify({ version, stages: manifest }, null, 2)};\n`;
fs.writeFileSync(path.join(wordDataDir, "builtin-manifest.js"), manifestScript);

console.log(`Generated ${lists.length} stage assets with ${lists.reduce((sum, list) => sum + list.words.length, 0)} words.`);
