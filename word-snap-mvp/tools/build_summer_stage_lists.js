const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(appRoot, "..");
const sourceDir = path.join(appRoot, "word-data", "stages");
const outputRoots = [appRoot, path.join(repositoryRoot, "docs")];

const stagePlans = [
  {
    grade: "初一暑期必背词汇",
    filename: "grade7-summer-required.js",
    source: "初一暑期必背词汇（课内外 + 初中688高频词）",
    sources: ["初一课内词汇", "初一考试词汇", "初中688高频词"]
  },
  {
    grade: "初二暑期必背词汇",
    filename: "grade8-summer-required.js",
    source: "初二暑期必背词汇（课内外 + 初中688高频词）",
    sources: ["初二课内词汇", "初二考试词汇", "初中688高频词"]
  },
  {
    grade: "初三暑期必背词汇",
    filename: "grade9-summer-required.js",
    source: "初三暑期必背词汇（课内外 + 初中688高频词）",
    sources: ["初三课内词汇", "初三考试词汇", "初中688高频词"]
  },
  {
    grade: "高一暑期必背词汇",
    filename: "grade10-summer-required.js",
    sources: ["高一课内词汇", "高一考试词汇", "高一课改词库"]
  },
  {
    grade: "高二暑期必背词汇",
    filename: "grade11-summer-required.js",
    sources: ["高二课内词汇", "高二考试词汇"]
  },
  {
    grade: "高三暑假必背词汇",
    filename: "grade12-summer-required.js",
    sources: [
      "高一课内词汇",
      "高一考试词汇",
      "高一课改词库",
      "高二课内词汇",
      "高二考试词汇",
      "高三考试词汇"
    ]
  }
];

function loadSourceLists() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  fs.readdirSync(sourceDir)
    .filter((filename) => /^(?:(?:grade(?:7|8|9|10|11|12)-(?:inclass|exam|curriculum))|junior-high-frequency-688)\.js$/.test(filename))
    .sort()
    .forEach((filename) => {
      vm.runInContext(fs.readFileSync(path.join(sourceDir, filename), "utf8"), sandbox, { filename });
    });
  return sandbox.window.WORD_SNAP_STAGE_LISTS || {};
}

function normalizeEnglish(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function distinctValues(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function mergeWords(sourceNames, lists) {
  const merged = new Map();

  sourceNames.forEach((sourceName) => {
    const list = lists[sourceName];
    if (!list?.words?.length) throw new Error(`Missing source stage: ${sourceName}`);

    list.words.forEach((word) => {
      const key = normalizeEnglish(word.en);
      if (!key || !String(word.zh || "").trim()) return;
      if (!merged.has(key)) merged.set(key, []);
      merged.get(key).push(word);
    });
  });

  return [...merged.values()].map((rows) => {
    const first = rows[0];
    const result = {
      en: String(first.en).trim().replace(/\s+/g, " "),
      zh: distinctValues(rows.map((row) => row.zh)).join("；"),
      pos: distinctValues(rows.map((row) => row.pos)).join(" / "),
      notes: distinctValues(rows.map((row) => row.notes)).join("；"),
      frequency: Math.max(...rows.map((row) => Number(row.frequency || 0)))
    };

    for (const field of ["fixedMode", "choiceCount", "promptText", "promptLabel", "answerText", "answerFeedback"]) {
      const value = rows.find((row) => row[field])?.[field];
      if (value) result[field] = value;
    }
    const choiceOptions = rows.find((row) => Array.isArray(row.choiceOptions) && row.choiceOptions.length)?.choiceOptions;
    if (choiceOptions) result.choiceOptions = choiceOptions;

    return result;
  });
}

function renderStage(plan, words) {
  const list = {
    grade: plan.grade,
    goals: [plan.grade],
    source: plan.source || `${plan.grade}（课内外整合）`,
    sources: plan.sources,
    words
  };
  return [
    "window.WORD_SNAP_STAGE_LISTS = window.WORD_SNAP_STAGE_LISTS || {};",
    `window.WORD_SNAP_STAGE_LISTS[${JSON.stringify(plan.grade)}] = ${JSON.stringify(list, null, 2)};`,
    ""
  ].join("\n");
}

const sourceLists = loadSourceLists();
const summary = [];

stagePlans.forEach((plan) => {
  const words = mergeWords(plan.sources, sourceLists);
  const content = renderStage(plan, words);
  outputRoots.forEach((root) => {
    const target = path.join(root, "word-data", "stages", plan.filename);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  });
  summary.push(`${plan.grade}: ${words.length} 词`);
});

console.log(summary.join("\n"));
